import { Schema, model } from 'mongoose';

const UserSchema = new Schema({
  email: String,
  wallet: { type: String, required: true, unique: true, index: true }, // buyer/seller Solana wallet (base58)
  signatureVerified: { type: Boolean, default: false },
  lastSignedMessage: String,
  purchaseHistory: [{
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing' },
    purchasedAt: { type: Date, default: Date.now },
    filename: String,
    pricePaid: Number,
    reviewed: { type: Boolean, default: false } // Track if buyer reviewed this purchase
  }],

  // Seller rating aggregation (as a seller)
  sellerRating: {
    avgRating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0, min: 0 },
    totalSales: { type: Number, default: 0, min: 0 }
  },

  createdAt: { type: Date, default: Date.now }
});

export default model('User', UserSchema);