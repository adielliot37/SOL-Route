import { Router } from 'express';
import Listing from '../models/Listing.js';
import KeyVault from '../models/KeyVault.js';
import Order from '../models/Order.js';
import { aesEncryptFile, wrapKeyWithServerKms } from '../services/crypto.js';
import { storachaUpload, storachaRetrieve } from '../services/storacha.js';
import { generatePreview } from '../services/preview.js';

const router = Router();

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

    const filepath = `${listing.cid}/${listing.filename}`;
    const result = await storachaRetrieve(filepath);

    if (!result.file) {
      return res.status(500).json({ error: 'File retrieval returned no data' });
    }

    return res.json(result);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

router.post('/create', async (req, res) => {
  try {
    const { sellerId, sellerWallet, filename, name, description, preview, mime, base64File, priceLamports } = req.body;
    if (!sellerWallet || !base64File || !filename || !name || !description || !priceLamports) {
      return res.status(400).json({ error: 'missing required fields: sellerWallet, filename, name, description, base64File, priceLamports' });
    }

    const fileBuf = Buffer.from(base64File, 'base64');

    // Generate preview and extract metadata BEFORE encryption
    let generatedPreview = preview;
    let metadata = {};
    try {
      const previewResult = await generatePreview(fileBuf, mime, filename);
      generatedPreview = previewResult.preview;
      metadata = previewResult.metadata;
    } catch (previewError: any) {
      console.warn('Preview generation failed:', previewError.message);
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
      filename,
      name,
      description,
      preview: generatedPreview,
      mime,
      size: fileBuf.length,
      priceLamports,
      metadata
    });

    const wrapped = wrapKeyWithServerKms(aesKey, process.env.SERVER_KEY_HEX!);
    await KeyVault.create({ listingId: listing._id, ...wrapped });

    return res.json({ listingId: listing._id, cid, preview: generatedPreview, metadata });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;