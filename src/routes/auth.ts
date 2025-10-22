import { Router } from 'express';
import User from '../models/User';
import { verifySignature } from '../services/solana';

const router = Router();

router.post('/verify-wallet', async (req, res) => {
  try {
    const { wallet, message, signature } = req.body;
    
    if (!wallet || !message || !signature) {
      return res.status(400).json({ error: 'Missing wallet, message, or signature' });
    }

    const isValid = await verifySignature(wallet, message, signature);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    let user = await User.findOne({ wallet });
    if (!user) {
      user = await User.create({
        wallet,
        signatureVerified: true,
        lastSignedMessage: message
      });
    } else {
      user.signatureVerified = true;
      user.lastSignedMessage = message;
      await user.save();
    }

    return res.json({
      success: true,
      user: {
        wallet: user.wallet,
        signatureVerified: user.signatureVerified,
        createdAt: user.createdAt,
        purchaseHistory: user.purchaseHistory
      }
    });
  } catch (e: any) {
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
    const user = await User.findOne({ wallet: req.params.wallet })
      .populate({
        path: 'purchaseHistory.listingId',
        select: 'filename cid sellerWallet createdAt'
      });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      purchaseHistory: user.purchaseHistory.sort((a: any, b: any) =>
        new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime()
      )
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;
