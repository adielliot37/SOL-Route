import { Router } from 'express';
import Order from '../models/Order';
import Listing from '../models/Listing';
import KeyVault from '../models/KeyVault';
import User from '../models/User';
import { unwrapKeyWithServerKms, sealKeyToBuyer } from '../services/crypto';
import { verifyPaymentToWithMemo } from '../services/solana';

const router = Router();

router.post('/verify-and-deliver', async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ error: 'order not found' });

    if (order.status === 'DELIVERED') {
      return res.json({ ok: true, sealedKeyB64: order.sealedKeyB64, cid: (await Listing.findById(order.listingId))?.cid });
    }

    const listing = await Listing.findById(order.listingId);
    if (!listing) return res.status(404).json({ error: 'listing missing' });

    const check = await verifyPaymentToWithMemo(
      order.payment!.toWallet!,
      order.payment!.expectedLamports!,
      order.payment!.memo!
    );
    if (!check.ok) return res.status(202).json({ ok: false, status: 'AWAITING_PAYMENT' });

    order.status = 'PAID';
    order.payment!.txSig = check.signature!;
    order.payment!.confirmedAt = new Date((check as any).blockTime ? ((check as any).blockTime * 1000) : Date.now());
    await order.save();

    const vault = await KeyVault.findOne({ listingId: listing._id });
    if (!vault) return res.status(500).json({ error: 'key vault missing' });

    const aesKeyRaw = unwrapKeyWithServerKms({
      encKeyB64: vault.encKeyB64,
      ivB64: vault.ivB64,
      tagB64: vault.tagB64
    }, process.env.SERVER_KEY_HEX!);

    const sealedKeyB64 = await sealKeyToBuyer(aesKeyRaw, order.buyerEncPubKeyB64!);

    order.sealedKeyB64 = sealedKeyB64;
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

    return res.json({ ok: true, sealedKeyB64, cid: listing.cid, filename: listing.filename, mime: listing.mime });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;