import { Router } from 'express';
import Review from '../models/Review.js';
import Listing from '../models/Listing.js';
import User from '../models/User.js';
import Order from '../models/Order.js';

const router = Router();

/**
 * POST /reviews - Create a new review
 * Validates that the user has purchased the listing before allowing review
 */
router.post('/', async (req, res) => {
  try {
    const { listingId, reviewerWallet, rating, comment, orderId } = req.body;

    if (!listingId || !reviewerWallet || !rating || !comment || !orderId) {
      return res.status(400).json({
        error: 'Missing required fields: listingId, reviewerWallet, rating, comment, orderId'
      });
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Verify the listing exists
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Verify the order exists and belongs to this user
    const order = await Order.findOne({
      _id: orderId,
      listingId,
      buyerWallet: reviewerWallet,
      status: 'DELIVERED'
    });

    if (!order) {
      return res.status(403).json({
        error: 'You must purchase this listing before reviewing it'
      });
    }

    // Check if user already reviewed this order
    const existingReview = await Review.findOne({
      orderId,
      reviewerWallet
    });

    if (existingReview) {
      return res.status(400).json({ error: 'You have already reviewed this purchase' });
    }

    // Get or create reviewer user
    let reviewer = await User.findOne({ wallet: reviewerWallet });
    if (!reviewer) {
      reviewer = await User.create({ wallet: reviewerWallet });
    }

    // Create the review
    const review = await Review.create({
      listingId,
      reviewerWallet,
      reviewerId: reviewer._id,
      orderId,
      rating,
      comment
    });

    // Update listing rating aggregation
    const allReviews = await Review.find({ listingId });
    const totalRating = allReviews.reduce((sum: number, r: any) => sum + r.rating, 0);
    const avgRating = totalRating / allReviews.length;

    listing.avgRating = avgRating;
    listing.reviewCount = allReviews.length;
    await listing.save();

    // Update seller rating aggregation
    const seller = await User.findOne({ wallet: listing.sellerWallet });
    if (seller) {
      // Get all reviews for all listings by this seller
      const sellerListings = await Listing.find({ sellerWallet: listing.sellerWallet });
      const sellerListingIds = sellerListings.map((l: any) => l._id);
      const allSellerReviews = await Review.find({ listingId: { $in: sellerListingIds } });

      if (allSellerReviews.length > 0) {
        const totalSellerRating = allSellerReviews.reduce((sum: number, r: any) => sum + r.rating, 0);
        const avgSellerRating = totalSellerRating / allSellerReviews.length;

        seller.sellerRating = {
          avgRating: avgSellerRating,
          totalReviews: allSellerReviews.length,
          totalSales: sellerListingIds.length
        };
        await seller.save();
      }
    }

    // Mark purchase as reviewed
    const buyer = await User.findOne({ wallet: reviewerWallet });
    if (buyer) {
      const purchase = buyer.purchaseHistory.find(
        (p: any) => p.orderId?.toString() === orderId.toString()
      );
      if (purchase) {
        purchase.reviewed = true;
        await buyer.save();
      }
    }

    return res.json({
      success: true,
      review: {
        _id: review._id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt
      },
      updatedRating: {
        avgRating: listing.avgRating,
        reviewCount: listing.reviewCount
      }
    });
  } catch (e: any) {
    console.error('Review creation error:', e);
    return res.status(500).json({ error: e.message });
  }
});

/**
 * GET /reviews/listing/:id - Get all reviews for a listing
 */
router.get('/listing/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0, sortBy = 'createdAt', order = 'desc' } = req.query;

    const reviews = await Review.find({ listingId: id })
      .sort({ [sortBy as string]: order === 'desc' ? -1 : 1 })
      .skip(Number(offset))
      .limit(Number(limit))
      .lean();

    const total = await Review.countDocuments({ listingId: id });

    // Get listing rating summary
    const listing = await Listing.findById(id);

    return res.json({
      reviews,
      total,
      limit: Number(limit),
      offset: Number(offset),
      summary: listing ? {
        avgRating: listing.avgRating,
        reviewCount: listing.reviewCount
      } : null
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

/**
 * GET /reviews/seller/:wallet - Get all reviews for a seller's listings
 */
router.get('/seller/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Get all listings by this seller
    const listings = await Listing.find({ sellerWallet: wallet });
    const listingIds = listings.map((l: any) => l._id);

    // Get all reviews for these listings
    const reviews = await Review.find({ listingId: { $in: listingIds } })
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit))
      .populate('listingId', 'name filename')
      .lean();

    const total = await Review.countDocuments({ listingId: { $in: listingIds } });

    // Get seller rating summary
    const seller = await User.findOne({ wallet });

    return res.json({
      reviews,
      total,
      limit: Number(limit),
      offset: Number(offset),
      sellerRating: seller?.sellerRating || {
        avgRating: 0,
        totalReviews: 0,
        totalSales: 0
      }
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

/**
 * GET /reviews/user/:wallet - Get all reviews written by a user
 */
router.get('/user/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const reviews = await Review.find({ reviewerWallet: wallet })
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit))
      .populate('listingId', 'name filename preview')
      .lean();

    const total = await Review.countDocuments({ reviewerWallet: wallet });

    return res.json({
      reviews,
      total,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

/**
 * POST /reviews/:id/seller-response - Add seller response to a review
 */
router.post('/:id/seller-response', async (req, res) => {
  try {
    const { id } = req.params;
    const { sellerWallet, response } = req.body;

    if (!sellerWallet || !response) {
      return res.status(400).json({ error: 'Missing sellerWallet or response' });
    }

    const review = await Review.findById(id).populate('listingId');
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Verify the seller owns the listing
    const listing = review.listingId as any;
    if (listing.sellerWallet !== sellerWallet) {
      return res.status(403).json({ error: 'Only the seller can respond to reviews' });
    }

    review.sellerResponse = {
      comment: response,
      respondedAt: new Date()
    };
    await review.save();

    return res.json({
      success: true,
      review
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

/**
 * POST /reviews/:id/helpful - Mark a review as helpful
 */
router.post('/:id/helpful', async (req, res) => {
  try {
    const { id } = req.params;

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    review.helpful = (review.helpful || 0) + 1;
    await review.save();

    return res.json({
      success: true,
      helpful: review.helpful
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

/**
 * GET /reviews/can-review/:listingId/:wallet - Check if user can review a listing
 */
router.get('/can-review/:listingId/:wallet', async (req, res) => {
  try {
    const { listingId, wallet } = req.params;

    // Find all delivered orders for this listing and wallet
    const orders = await Order.find({
      listingId,
      buyerWallet: wallet,
      status: 'DELIVERED'
    });

    if (orders.length === 0) {
      return res.json({
        canReview: false,
        reason: 'Must purchase listing first'
      });
    }

    // Check if any of these orders haven't been reviewed yet
    for (const order of orders) {
      const existingReview = await Review.findOne({
        orderId: order._id,
        reviewerWallet: wallet
      });

      if (!existingReview) {
        return res.json({
          canReview: true,
          orderId: order._id
        });
      }
    }

    return res.json({
      canReview: false,
      reason: 'Already reviewed all purchases of this listing'
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;
