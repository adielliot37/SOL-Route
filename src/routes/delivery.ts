import { Router } from 'express';
import Order from '../models/Order.js';
import Listing from '../models/Listing.js';
import KeyVault from '../models/KeyVault.js';
import User from '../models/User.js';
import { sealKeyToBuyer } from '../services/crypto.js';
import { unwrapKeyWithKms } from '../services/kms.js';
import { verifyPaymentToWithMemo } from '../services/solana.js';

const router = Router();

router.post('/verify-and-deliver', async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required' });
    }
    
    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ error: 'order not found' });

    if (order.status === 'DELIVERED') {
      const listing = await Listing.findById(order.listingId);
      return res.json({ 
        ok: true, 
        sealedKeyB64: order.sealedKeyB64, 
        ephemeralPubB64: order.ephemeralPubB64,
        cid: listing?.cid,
        filename: listing?.filename,
        mime: listing?.mime
      });
    }
    
    // Prevent race condition - check if already being processed
    if (order.status === 'PAID' && order.sealedKeyB64) {
      // Already delivered but status not updated, fix it
      order.status = 'DELIVERED';
      await order.save();
      const listing = await Listing.findById(order.listingId);
      return res.json({ 
        ok: true, 
        sealedKeyB64: order.sealedKeyB64, 
        ephemeralPubB64: order.ephemeralPubB64,
        cid: listing?.cid,
        filename: listing?.filename,
        mime: listing?.mime
      });
    }

    const listing = await Listing.findById(order.listingId);
    if (!listing) return res.status(404).json({ error: 'listing missing' });

    const check = await verifyPaymentToWithMemo(
      order.payment!.toWallet!,
      order.payment!.expectedLamports!,
      order.payment!.memo!
    );
    if (!check.ok) return res.status(202).json({ ok: false, status: 'AWAITING_PAYMENT' });

    // Check if transaction was already used (prevent replay)
    if (check.signature) {
      const existingOrder = await Order.findOne({ 
        'payment.txSig': check.signature,
        _id: { $ne: order._id }
      });
      if (existingOrder) {
        return res.status(400).json({ error: 'Transaction signature already used' });
      }
    }

    order.status = 'PAID';
    order.payment!.txSig = check.signature!;
    order.payment!.confirmedAt = new Date((check as any).blockTime ? ((check as any).blockTime * 1000) : Date.now());
    await order.save();

    const vault = await KeyVault.findOne({ listingId: listing._id });
    if (!vault) return res.status(500).json({ error: 'key vault missing' });

    // Unwrap the AES key using KMS
    const aesKeyRaw = await unwrapKeyWithKms({
      encKeyB64: vault.encKeyB64,
      ivB64: vault.ivB64,
      tagB64: vault.tagB64,
      keyVersion: vault.keyVersion
    });

    // Seal key to buyer with ephemeral key exchange
    const sealed = await sealKeyToBuyer(aesKeyRaw, order.buyerEncPubKeyB64!);

    order.sealedKeyB64 = sealed.sealedKeyB64;
    order.ephemeralPubB64 = sealed.ephemeralPubB64;
    order.status = 'DELIVERED';
    order.deliveredAt = new Date();
    await order.save();

    if (order.buyerWallet) {
      const buyer = await User.findOne({ wallet: order.buyerWallet });
      if (buyer) {
        const existingPurchase = buyer.purchaseHistory.find(
          (p: any) => p.orderId?.toString() === order._id.toString()
        );

        if (!existingPurchase) {
          buyer.purchaseHistory.push({
            orderId: order._id,
            listingId: listing._id,
            purchasedAt: order.deliveredAt,
            filename: listing.filename,
            pricePaid: order.payment?.expectedLamports || listing.priceLamports
          });
          await buyer.save();
        }
      }
    }

    return res.json({ 
      ok: true, 
      sealedKeyB64: sealed.sealedKeyB64,
      ephemeralPubB64: sealed.ephemeralPubB64,
      cid: listing.cid, 
      filename: listing.filename, 
      mime: listing.mime 
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;