import { Schema, model } from 'mongoose';

const OrderSchema = new Schema({
  listingId: { type: Schema.Types.ObjectId, ref: 'Listing', index: true },
  orderId: { type: String, unique: true, index: true }, // UUID used as Memo
  buyerEncPubKeyB64: String,  // buyer's X25519 public key (base64)
  buyerWallet: { type: String, index: true },        // optional, if you capture payer wallet
  status: { type: String, enum: ['PENDING','PAID','DELIVERED','EXPIRED'], default: 'PENDING', index: true },
  payment: {
    expectedLamports: Number,
    toWallet: String,
    memo: String,            // same as orderId
    txSig: { type: String, index: true },           // once verified
    confirmedAt: Date
  },
  sealedKeyB64: String,       // encrypted-to-buyer AES key (after payment)
  ephemeralPubB64: String,    // ephemeral public key for forward secrecy
  deliveredAt: Date,
  createdAt: { type: Date, default: Date.now, index: true }
});

// Compound indexes for common queries
OrderSchema.index({ buyerWallet: 1, status: 1 });
OrderSchema.index({ listingId: 1, buyerWallet: 1, status: 1 });
OrderSchema.index({ 'payment.txSig': 1 });

export default model('Order', OrderSchema);