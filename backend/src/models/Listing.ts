import { Schema, model } from 'mongoose';

const ListingSchema = new Schema({
  sellerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  sellerWallet: { type: String, required: true, index: true },   // base58
  cid: { type: String, required: true, index: true },            // IPFS CID of ciphertext
  contentHash: { type: String, index: true },
  filename: String,
  name: { type: String, required: true },           // Display name
  description: { type: String, required: true },    // Description
  preview: String,                                  // Optional preview URL or base64
  thumbnailCid: String,                             // IPFS CID for thumbnail if uploaded
  mime: String,
  size: Number,
  priceLamports: { type: Number, required: true, index: true },

  // File metadata (extracted before encryption)
  metadata: {
    width: Number,        // For images/videos
    height: Number,       // For images/videos
    duration: Number,     // For videos/audio (in seconds)
    pages: Number,        // For documents
    format: String,       // Specific format info
    hasAudio: Boolean,    // For videos
    codec: String         // For media files
  },

  // Rating aggregation
  avgRating: { type: Number, default: 0, min: 0, max: 5, index: true },
  reviewCount: { type: Number, default: 0, min: 0 },

  createdAt: { type: Date, default: Date.now, index: true }
});

// Compound indexes for common queries
ListingSchema.index({ sellerWallet: 1, createdAt: -1 });
ListingSchema.index({ createdAt: -1 });
ListingSchema.index({ priceLamports: 1, createdAt: -1 });
ListingSchema.index({ contentHash: 1 }, { unique: true, partialFilterExpression: { contentHash: { $type: 'string' } } });

export default model('Listing', ListingSchema);
