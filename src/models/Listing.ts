import { Schema, model } from 'mongoose';

const ListingSchema = new Schema({
  sellerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  sellerWallet: { type: String, required: true },   // base58
  cid: { type: String, required: true },            // IPFS CID of ciphertext
  filename: String,
  name: { type: String, required: true },           // Display name
  description: { type: String, required: true },    // Description
  preview: String,                                  // Optional preview URL
  mime: String,
  size: Number,
  priceLamports: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default model('Listing', ListingSchema);