import { Router } from 'express';
import Order from '../models/Order.js';
import Listing from '../models/Listing.js';
import KeyVault from '../models/KeyVault.js';
import User from '../models/User.js';
import { sealKeyToBuyer } from '../services/crypto.js';
import { unwrapKeyWithKms } from '../services/kms.js';
import { verifyPaymentToWithMemo } from '../services/solana.js';
import { strictLimiter } from '../middleware/rateLimiter.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.post('/verify-and-deliver', strictLimiter, async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required' });
    }
    
    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ error: 'order not found' });

    if (order.status === 'DELIVERED') {
      const listing = await Listing.findById(order.listingId);
      if (listing?.withdrawnAt) {
        return res.status(403).json({ error: 'This dataset has been withdrawn by the owner' });
      }
      return res.json({ 
        ok: true, 
        sealedKeyB64: order.sealedKeyB64, 
        ephemeralPubB64: order.ephemeralPubB64,
        cid: listing?.cid,
        filename: listing?.filename,
        mime: listing?.mime
      });
    }
    
    if (order.status === 'PAID' && order.sealedKeyB64) {
      order.status = 'DELIVERED';
      await order.save();
      const listing = await Listing.findById(order.listingId);
      if (listing?.withdrawnAt) {
        return res.status(403).json({ error: 'This dataset has been withdrawn by the owner' });
      }
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
    if (!listing) return res.status(404).json({ error: 'dataset listing missing' });

    if (listing.withdrawnAt) {
      return res.status(403).json({ error: 'This dataset has been withdrawn by the owner' });
    }

    const check = await verifyPaymentToWithMemo(
      order.payment!.toWallet!,
      order.payment!.expectedLamports!,
      order.payment!.memo!
    );
    if (!check.ok) return res.status(202).json({ ok: false, status: 'AWAITING_PAYMENT' });

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

    const aesKeyRaw = await unwrapKeyWithKms({
      encKeyB64: vault.encKeyB64,
      ivB64: vault.ivB64,
      tagB64: vault.tagB64,
      keyVersion: vault.keyVersion
    });

    const sealed = await sealKeyToBuyer(aesKeyRaw, order.buyerEncPubKeyB64!);

    order.sealedKeyB64 = sealed.sealedKeyB64;
    order.ephemeralPubB64 = sealed.ephemeralPubB64;
    order.status = 'DELIVERED';
    order.deliveredAt = new Date();
    order.auditLog.push({
      timestamp: new Date(),
      action: 'DATA_DELIVERED',
      details: `Dataset access granted to buyer ${order.buyerWallet}`
    });
    await order.save();

    if (order.buyerWallet) {
      let buyer = await User.findOne({ wallet: order.buyerWallet });
      if (!buyer) {
        buyer = await User.create({ wallet: order.buyerWallet });
      }
      
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

router.post('/revoke-access', strictLimiter, async (req, res) => {
  try {
    const { orderId, sellerWallet, reason } = req.body;
    
    if (!orderId || !sellerWallet) {
      return res.status(400).json({ error: 'orderId and sellerWallet are required' });
    }

    const order = await Order.findOne({ orderId }).populate('listingId');
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const listing = order.listingId as any;
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.sellerWallet !== sellerWallet) {
      return res.status(403).json({ error: 'Only the dataset owner can revoke access' });
    }

    if (order.accessRevoked) {
      return res.status(400).json({ error: 'Access already revoked' });
    }

    order.accessRevoked = true;
    order.accessRevokedAt = new Date();
    order.accessRevokedReason = reason || 'Revoked by data owner under EU Data Act rights';
    order.auditLog.push({
      timestamp: new Date(),
      action: 'ACCESS_REVOKED',
      details: `Access revoked by owner ${sellerWallet}. Reason: ${reason || 'Not specified'}`
    });

    await order.save();

    logger.info({ orderId, sellerWallet }, 'Data access revoked by owner');

    return res.json({ 
      success: true, 
      message: 'Access revoked successfully',
      revokedAt: order.accessRevokedAt 
    });
  } catch (e: any) {
    logger.error({ error: e.message, orderId: req.body.orderId }, 'Error revoking access');
    return res.status(500).json({ error: e.message });
  }
});

export default router;
