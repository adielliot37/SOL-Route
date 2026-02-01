import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import Listing from '../models/Listing.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import KeyVault from '../models/KeyVault.js';
import { createPaymentTransaction, submitTransaction } from '../services/solana.js';
import { unwrapKeyWithServerKms, sealKeyToBuyer } from '../services/crypto.js';
import { strictLimiter } from '../middleware/rateLimiter.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Check if user already purchased a listing
router.get('/check/:listingId/:wallet', async (req, res) => {
  try {
    const { listingId, wallet } = req.params;

    // Find any delivered order for this listing and wallet
    const order = await Order.findOne({
      listingId,
      buyerWallet: wallet,
      status: 'DELIVERED'
    });

    if (!order || !order.sealedKeyB64) {
      return res.json({ purchased: false });
    }

    // Get listing info
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    return res.json({
      purchased: true,
      delivery: {
        sealedKeyB64: order.sealedKeyB64,
        cid: listing.cid,
        filename: listing.filename,
        mime: listing.mime
      }
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

router.post('/init', strictLimiter, async (req, res) => {
  try {
    const { listingId, buyerEncPubKeyB64, buyerWallet, consentAccepted, dataAccessTermsAccepted } = req.body;
    
    if (!listingId || !buyerEncPubKeyB64 || !buyerWallet) {
      return res.status(400).json({ error: 'Missing required fields: listingId, buyerEncPubKeyB64, buyerWallet' });
    }
    
    try {
      Buffer.from(buyerEncPubKeyB64, 'base64');
    } catch (e) {
      return res.status(400).json({ error: 'Invalid buyerEncPubKeyB64 format' });
    }
    
    const listing = await Listing.findById(listingId);
    if (!listing) return res.status(404).json({ error: 'dataset listing not found' });

    if (listing.withdrawnAt) {
      return res.status(400).json({ error: 'This dataset has been withdrawn by the owner' });
    }

    if (listing.sellerWallet === buyerWallet) {
      return res.status(400).json({ error: 'Cannot purchase your own dataset listing' });
    }
    
    if (listing.consentRequired && !consentAccepted) {
      return res.status(400).json({ error: 'Consent is required to purchase this dataset under EU Data Act regulations' });
    }

    if (!dataAccessTermsAccepted) {
      return res.status(400).json({ error: 'Data access terms must be accepted' });
    }
    
    const existingOrder = await Order.findOne({
      listingId,
      buyerWallet,
      status: 'DELIVERED',
      accessRevoked: { $ne: true }
    });
    if (existingOrder) {
      return res.status(400).json({ error: 'You have already purchased this dataset' });
    }

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const orderId = uuidv4();
    const order = await Order.create({
      listingId,
      orderId,
      buyerEncPubKeyB64,
      buyerWallet,
      consentAccepted: consentAccepted || false,
      consentAcceptedAt: consentAccepted ? new Date() : undefined,
      dataAccessTermsAccepted: dataAccessTermsAccepted || false,
      payment: {
        expectedLamports: listing.priceLamports,
        toWallet: listing.sellerWallet,
        memo: orderId
      },
      auditLog: [{
        timestamp: new Date(),
        action: 'ORDER_INITIATED',
        details: `Buyer ${buyerWallet} initiated purchase with consent: ${consentAccepted}`
      }]
    });

    if (listing.consentLog) {
      listing.consentLog.push({
        timestamp: new Date(),
        action: 'PURCHASE_INITIATED',
        wallet: buyerWallet,
        ipAddress: ipAddress
      });
      await listing.save();
    }

    return res.json({
      orderId,
      payTo: listing.sellerWallet,
      lamports: listing.priceLamports,
      memo: orderId,
      network: 'solana-devnet'
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

router.post('/pay-direct', strictLimiter, async (req, res) => {
  try {
    const { orderId, signedTransaction } = req.body;
    
    if (!orderId || !signedTransaction) {
      return res.status(400).json({ error: 'Missing orderId or signedTransaction' });
    }

    const order = await Order.findOne({ orderId }).populate('listingId');
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'PAID' || order.status === 'DELIVERED') {
      return res.status(400).json({ error: 'Order already processed' });
    }

    const transactionBuffer = Buffer.from(signedTransaction, 'base64');
    const signature = await submitTransaction(transactionBuffer);

    order.status = 'PAID';
    order.payment.txSig = signature;
    order.payment.confirmedAt = new Date();
    await order.save();

    let user = await User.findOne({ wallet: order.buyerWallet });
    if (!user) {
      user = await User.create({ wallet: order.buyerWallet });
    }
    
    user.purchaseHistory.push({
      orderId: order._id,
      listingId: order.listingId._id,
      purchasedAt: new Date(),
      filename: order.listingId.filename,
      pricePaid: order.payment.expectedLamports
    });
    await user.save();

    return res.json({
      success: true,
      signature,
      orderId
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

router.post('/create-transaction', async (req, res) => {
  try {
    const { orderId } = req.body;
    
    const order = await Order.findOne({ orderId }).populate('listingId');
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'PAID' || order.status === 'DELIVERED') {
      return res.status(400).json({ error: 'Order already processed' });
    }

    const serializedTransaction = await createPaymentTransaction(
      order.buyerWallet,
      order.payment.toWallet,
      order.payment.expectedLamports,
      order.payment.memo
    );

    return res.json({
      transaction: serializedTransaction.toString('base64'),
      orderId
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;
