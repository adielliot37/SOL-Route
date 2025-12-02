import { Router } from 'express';
import User from '../models/User';
import { verifySignature } from '../services/solana';
import { logger } from '../utils/logger.js';

const router = Router();

router.post('/verify-wallet', async (req, res) => {
  try {
    const { wallet, message, signature, isLogin } = req.body;
    
    if (!wallet || !message || !signature) {
      return res.status(400).json({ error: 'Missing wallet, message, or signature' });
    }

    const isValid = await verifySignature(wallet, message, signature);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    let user = await User.findOne({ wallet });
    const isNewUser = !user;
    
    if (!user) {
      // New user registration
      user = await User.create({
        wallet,
        signatureVerified: true,
        lastSignedMessage: message
      });
      logger.info({ wallet }, 'New user registered');
    } else {
      // Existing user login
      user.signatureVerified = true;
      user.lastSignedMessage = message;
      await user.save();
      logger.info({ wallet }, 'User logged in');
    }

    return res.json({
      success: true,
      isNewUser,
      user: {
        wallet: user.wallet,
        signatureVerified: user.signatureVerified,
        createdAt: user.createdAt,
        purchaseHistory: user.purchaseHistory
      }
    });
  } catch (e: any) {
    logger.error({ error: e.message, wallet: req.body.wallet }, 'Error verifying wallet');
    return res.status(500).json({ error: e.message });
  }
});

router.get('/profile/:wallet', async (req, res) => {
  try {
    const user = await User.findOne({ wallet: req.params.wallet })
      .populate('purchaseHistory.listingId', 'filename cid')
      .populate('purchaseHistory.orderId');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      wallet: user.wallet,
      createdAt: user.createdAt,
      signatureVerified: user.signatureVerified,
      purchaseHistory: user.purchaseHistory
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// Check if user exists (for determining registration vs login)
router.get('/check-user/:wallet', async (req, res) => {
  try {
    const user = await User.findOne({ wallet: req.params.wallet });
    return res.json({ exists: !!user, verified: user?.signatureVerified || false });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

router.post('/disconnect', async (req, res) => {
  try {
    const { wallet } = req.body;
    
    if (!wallet) {
      return res.status(400).json({ error: 'Missing wallet address' });
    }

    const user = await User.findOne({ wallet });
    if (user) {
      user.signatureVerified = false;
      user.lastSignedMessage = '';
      await user.save();
    }

    return res.json({ success: true, message: 'Wallet disconnected successfully' });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

router.get('/purchase-history/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet;
    
    // Query Orders directly instead of relying on User.purchaseHistory
    // This is more reliable as it checks the source of truth
    const Order = (await import('../models/Order.js')).default;
    const Listing = (await import('../models/Listing.js')).default;
    
    const orders = await Order.find({
      buyerWallet: wallet,
      status: 'DELIVERED'
    })
      .populate('listingId', 'filename cid sellerWallet createdAt name description mime size priceLamports')
      .sort({ deliveredAt: -1, createdAt: -1 });
    
    logger.info({ wallet, orderCount: orders.length }, 'Fetching purchase history');
    
    // Transform orders to match the expected purchaseHistory format
    const purchaseHistory = orders.map((order: any) => ({
      orderId: order._id,
      listingId: order.listingId ? {
        _id: order.listingId._id,
        filename: order.listingId.filename,
        cid: order.listingId.cid,
        mime: order.listingId.mime,
        sellerWallet: order.listingId.sellerWallet,
        createdAt: order.listingId.createdAt,
        name: order.listingId.name,
        description: order.listingId.description,
        size: order.listingId.size,
        priceLamports: order.listingId.priceLamports,
      } : null,
      purchasedAt: order.deliveredAt || order.createdAt,
      filename: order.listingId?.filename || 'Unknown',
      pricePaid: order.payment?.expectedLamports || order.listingId?.priceLamports || 0,
      reviewed: false // Can be enhanced later to check Review model
    })).filter((p: any) => p.listingId !== null); // Filter out any with missing listings

    return res.json({
      purchaseHistory
    });
  } catch (e: any) {
    logger.error({ error: e.message, wallet: req.params.wallet }, 'Error fetching purchase history');
    return res.status(500).json({ error: e.message });
  }
});

export default router;
