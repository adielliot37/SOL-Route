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
import { uploadLimiter } from '../middleware/rateLimiter.js';
import { logger } from '../utils/logger.js';

const router = Router();

// File upload route needs larger body size limit
const fileUploadParser = json({ limit: '50mb' });

router.get('/', async (req, res) => {
  try {
    const listings = await Listing.find({}).sort({ createdAt: -1 });
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
          status: { $in: ['PAID', 'DELIVERED'] }
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

    // Optionally include recent reviews
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
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Optional: Add authorization check here if needed
    // For now, we rely on the encrypted nature of the file
    // The file is encrypted, so even if accessed, it's useless without the key

    const filepath = `${listing.cid}/${listing.filename}`;
    const result = await storachaRetrieve(filepath);

    if (!result.file) {
      logger.error({ listingId: req.params.id }, 'File retrieval returned no data');
      return res.status(500).json({ error: 'File retrieval returned no data' });
    }

    return res.json(result);
  } catch (e: any) {
    logger.error({ error: e.message, listingId: req.params.id }, 'Error retrieving file');
    return res.status(500).json({ error: 'Failed to retrieve file' });
  }
});

router.post('/create', uploadLimiter, fileUploadParser, async (req, res) => {
  try {
    logger.info({ sellerWallet: req.body.sellerWallet }, 'Creating listing...');
    const { sellerId, sellerWallet, filename, name, description, preview, mime, base64File, priceLamports } = req.body;
    if (!sellerWallet || !base64File || !filename || !name || !description || !priceLamports) {
      return res.status(400).json({ error: 'missing required fields: sellerWallet, filename, name, description, base64File, priceLamports' });
    }

    // Validate price
    if (typeof priceLamports !== 'number' || priceLamports <= 0) {
      return res.status(400).json({ error: 'Price must be a positive number' });
    }
    if (priceLamports > 1_000_000_000_000) { // 1000 SOL max
      return res.status(400).json({ error: 'Price cannot exceed 1000 SOL' });
    }

    // Validate and sanitize inputs
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

    // Validate file size and type
    const validation = validateFile(fileBuf, mime, filename);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Validate preview URL if provided
    if (preview && typeof preview === 'string' && preview.startsWith('http')) {
      const urlValidation = validatePreviewUrl(preview);
      if (!urlValidation.valid) {
        logger.warn({ preview, error: urlValidation.error }, 'Invalid preview URL');
        return res.status(400).json({ error: `Invalid preview URL: ${urlValidation.error}` });
      }
    }

    // Generate preview and extract metadata BEFORE encryption
    let generatedPreview = preview;
    let metadata = {};
    try {
      const previewResult = await generatePreview(fileBuf, mime, filename);
      generatedPreview = previewResult.preview;
      metadata = previewResult.metadata;
    } catch (previewError: any) {
      logger.warn({ error: previewError.message }, 'Preview generation failed');
      // Continue without preview if generation fails
    }

    const { key: aesKey, blob } = aesEncryptFile(fileBuf);

    const payload = Buffer.concat([blob.iv, blob.tag, blob.ciphertext]);

    const up = await storachaUpload(payload.toString('base64'), filename, false);
    const cid = up.cid;

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
      metadata
    });

    // Use KMS to wrap the encryption key
    const wrapped = await wrapKeyWithKms(aesKey);
    await KeyVault.create({ listingId: listing._id, ...wrapped });

    logger.info({ listingId: listing._id, cid }, 'Listing created successfully');
    return res.json({ listingId: listing._id, cid, preview: generatedPreview, metadata });
  } catch (e: any) {
    logger.error({ error: e.message, stack: e.stack }, 'Error creating listing');
    return res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Failed to create listing' : e.message });
  }
});

export default router;