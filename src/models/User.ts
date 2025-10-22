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
    pricePaid: Number
  }],
  createdAt: { type: Date, default: Date.now }
});

export default model('User', UserSchema);