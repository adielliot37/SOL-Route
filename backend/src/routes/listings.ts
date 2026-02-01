import { Router, json } from 'express';
import Listing from '../models/Listing.js';
import Order from '../models/Order.js';
import KeyVault from '../models/KeyVault.js';
import { storachaUpload, storachaRetrieve } from '../services/storacha.js';
import { aesEncryptFile } from '../services/crypto.js';
import { wrapKeyWithKms } from '../services/kms.js';
import { generatePreview } from '../services/preview.js';
import { validateFile } from '../utils/fileValidation.js';
import { validatePreviewUrl } from '../utils/urlValidation.js';
import { uploadLimiter, strictLimiter } from '../middleware/rateLimiter.js';
import { logger } from '../utils/logger.js';

const router = Router();

const fileUploadParser = json({ limit: '50mb' });

router.get('/', async (req, res) => {
  try {
    const listings = await Listing.find({ 
      withdrawnAt: { $exists: false },
      withdrawalEnabled: true 
    }).sort({ createdAt: -1 });
    return res.json(listings);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

router.get('/seller/:wallet', async (req, res) => {
  try {
    const listings = await Listing.find({ sellerWallet: req.params.wallet }).sort({ createdAt: -1 });

    const listingsWithOrders = await Promise.all(
      listings.map(async (listing: any) => {
        const orders = await Order.find({
          listingId: listing._id,
          status: { $in: ['PAID', 'DELIVERED'] },
          accessRevoked: { $ne: true }
        }).sort({ confirmedAt: -1 });

        return {
          ...listing.toObject(),
          purchases: orders.map((order: any) => ({
            orderId: order.orderId,
            buyerWallet: order.buyerWallet,
            status: order.status,
            paidAt: order.payment?.confirmedAt,
            deliveredAt: order.deliveredAt,
            txSig: order.payment?.txSig
          }))
        };
      })
    );

    return res.json(listingsWithOrders);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { includeReviews = 'false' } = req.query;
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (includeReviews === 'true') {
      const Review = (await import('../models/Review.js')).default;
      const recentReviews = await Review.find({ listingId: req.params.id })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      return res.json({
        ...listing.toObject(),
        recentReviews
      });
    }

    return res.json(listing);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

router.get('/:id/file', async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ error: 'Dataset listing not found' });
    }

    if (listing.withdrawnAt) {
      return res.status(403).json({ error: 'This dataset has been withdrawn by the owner' });
    }

    const filepath = `${listing.cid}/${listing.filename}`;
    const result = await storachaRetrieve(filepath);

    if (!result.file) {
      logger.error({ listingId: req.params.id }, 'Dataset retrieval returned no data');
      return res.status(500).json({ error: 'Dataset retrieval returned no data' });
    }

    return res.json(result);
  } catch (e: any) {
    logger.error({ error: e.message, listingId: req.params.id }, 'Error retrieving dataset');
    return res.status(500).json({ error: 'Failed to retrieve dataset' });
  }
});

router.post('/withdraw/:id', strictLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { sellerWallet, reason } = req.body;

    if (!sellerWallet) {
      return res.status(400).json({ error: 'sellerWallet is required' });
    }

    const listing = await Listing.findById(id);
    if (!listing) {
      return res.status(404).json({ error: 'Dataset listing not found' });
    }

    if (listing.sellerWallet !== sellerWallet) {
      return res.status(403).json({ error: 'Only the dataset owner can withdraw it' });
    }

    if (listing.withdrawnAt) {
      return res.status(400).json({ error: 'Dataset already withdrawn' });
    }

    listing.withdrawnAt = new Date();
    listing.withdrawnReason = reason || 'Withdrawn by owner';
    listing.withdrawalEnabled = false;

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    listing.consentLog.push({
      timestamp: new Date(),
      action: 'DATASET_WITHDRAWN',
      wallet: sellerWallet,
      ipAddress: ipAddress
    });

    await listing.save();

    logger.info({ listingId: id, sellerWallet }, 'Dataset withdrawn by owner');

    return res.json({ 
      success: true, 
      message: 'Dataset withdrawn successfully',
      withdrawnAt: listing.withdrawnAt 
    });
  } catch (e: any) {
    logger.error({ error: e.message, listingId: req.params.id }, 'Error withdrawing dataset');
    return res.status(500).json({ error: e.message });
  }
});

router.post('/create', uploadLimiter, fileUploadParser, async (req, res) => {
  try {
    logger.info({ sellerWallet: req.body.sellerWallet }, 'Creating dataset listing...');
    const { sellerId, sellerWallet, filename, name, description, preview, mime, base64File, priceLamports, dataSource, dataType, anonymized, recordCount, timeRange, geographicScope, dataAccessTerms, ownershipProof } = req.body;
    if (!sellerWallet || !base64File || !filename || !name || !description || !priceLamports) {
      return res.status(400).json({ error: 'missing required fields: sellerWallet, filename, name, description, base64File, priceLamports' });
    }

    if (typeof priceLamports !== 'number' || priceLamports <= 0) {
      return res.status(400).json({ error: 'Price must be a positive number' });
    }
    if (priceLamports > 1_000_000_000_000) {
      return res.status(400).json({ error: 'Price cannot exceed 1000 SOL' });
    }

    if (typeof name !== 'string' || name.trim().length === 0 || name.length > 200) {
      return res.status(400).json({ error: 'Name must be between 1 and 200 characters' });
    }
    if (typeof description !== 'string' || description.trim().length === 0 || description.length > 2000) {
      return res.status(400).json({ error: 'Description must be between 1 and 2000 characters' });
    }
    if (typeof filename !== 'string' || filename.length === 0 || filename.length > 255) {
      return res.status(400).json({ error: 'Filename must be between 1 and 255 characters' });
    }

    const fileBuf = Buffer.from(base64File, 'base64');

    const validation = validateFile(fileBuf, mime, filename);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    if (preview && typeof preview === 'string' && preview.startsWith('http')) {
      const urlValidation = validatePreviewUrl(preview);
      if (!urlValidation.valid) {
        logger.warn({ preview, error: urlValidation.error }, 'Invalid preview URL');
        return res.status(400).json({ error: `Invalid preview URL: ${urlValidation.error}` });
      }
    }

    let generatedPreview = preview;
    let metadata = {};
    try {
      const previewResult = await generatePreview(fileBuf, mime, filename);
      generatedPreview = previewResult.preview;
      metadata = previewResult.metadata;
    } catch (previewError: any) {
      logger.warn({ error: previewError.message }, 'Preview generation failed');
    }

    const { key: aesKey, blob } = aesEncryptFile(fileBuf);

    const payload = Buffer.concat([blob.iv, blob.tag, blob.ciphertext]);

    const up = await storachaUpload(payload.toString('base64'), filename, false);
    const cid = up.cid;

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const ownershipProofValue = ownershipProof || `${sellerWallet}-${Date.now()}-${cid}`;

    const listing = await Listing.create({
      sellerId,
      sellerWallet,
      cid,
      filename: filename.trim(),
      name: name.trim(),
      description: description.trim(),
      preview: generatedPreview,
      mime: mime || 'application/octet-stream',
      size: fileBuf.length,
      priceLamports,
      dataSource: dataSource || undefined,
      dataType: dataType || undefined,
      anonymized: anonymized === true || anonymized === 'true',
      recordCount: recordCount ? parseInt(recordCount) : undefined,
      timeRange: timeRange ? {
        start: timeRange.start ? new Date(timeRange.start) : undefined,
        end: timeRange.end ? new Date(timeRange.end) : undefined
      } : undefined,
      geographicScope: geographicScope || undefined,
      euDataActCompliant: true,
      ownershipProof: ownershipProofValue,
      dataAccessTerms: dataAccessTerms || 'By purchasing this dataset, you agree to use it in compliance with EU Data Act and GDPR regulations. You may not redistribute or share this data without explicit permission.',
      consentRequired: true,
      withdrawalEnabled: true,
      consentLog: [{
        timestamp: new Date(),
        action: 'LISTING_CREATED',
        wallet: sellerWallet,
        ipAddress: ipAddress
      }],
      metadata
    });

    const wrapped = await wrapKeyWithKms(aesKey);
    await KeyVault.create({ listingId: listing._id, ...wrapped });

    logger.info({ listingId: listing._id, cid }, 'Dataset listing created successfully');
    return res.json({ listingId: listing._id, cid, preview: generatedPreview, metadata });
  } catch (e: any) {
    logger.error({ error: e.message, stack: e.stack }, 'Error creating listing');
    return res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Failed to create listing' : e.message });
  }
});

export default router;
