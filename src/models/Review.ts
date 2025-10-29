import { Schema, model } from 'mongoose';

const ReviewSchema = new Schema({
  listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
  reviewerWallet: { type: String, required: true, index: true },
  reviewerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true }, // Proof of purchase

  // Rating and review content
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true, maxlength: 2000 },

  // Seller response (optional)
  sellerResponse: {
    comment: String,
    respondedAt: Date
  },

  // Metadata
  helpful: { type: Number, default: 0 }, // Number of users who found this helpful
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Compound index to prevent duplicate reviews per order
ReviewSchema.index({ orderId: 1, reviewerWallet: 1 }, { unique: true });

// Index for efficient queries
ReviewSchema.index({ listingId: 1, createdAt: -1 });
ReviewSchema.index({ reviewerWallet: 1, createdAt: -1 });

export default model('Review', ReviewSchema);
