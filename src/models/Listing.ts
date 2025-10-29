import { Schema, model } from 'mongoose';

const ListingSchema = new Schema({
  sellerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  sellerWallet: { type: String, required: true },   // base58
  cid: { type: String, required: true },            // IPFS CID of ciphertext
  filename: String,
  name: { type: String, required: true },           // Display name
  description: { type: String, required: true },    // Description
  preview: String,                                  // Optional preview URL or base64
  thumbnailCid: String,                             // IPFS CID for thumbnail if uploaded
  mime: String,
  size: Number,
  priceLamports: { type: Number, required: true },

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
  avgRating: { type: Number, default: 0, min: 0, max: 5 },
  reviewCount: { type: Number, default: 0, min: 0 },

  createdAt: { type: Date, default: Date.now }
});

export default model('Listing', ListingSchema);