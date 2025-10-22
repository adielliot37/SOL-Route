import { Schema, model } from 'mongoose';

const OrderSchema = new Schema({
  listingId: { type: Schema.Types.ObjectId, ref: 'Listing', index: true },
  orderId: { type: String, unique: true, index: true }, // UUID used as Memo
  buyerEncPubKeyB64: String,  // buyer's X25519 public key (base64)
  buyerWallet: String,        // optional, if you capture payer wallet
  status: { type: String, enum: ['PENDING','PAID','DELIVERED','EXPIRED'], default: 'PENDING' },
  payment: {
    expectedLamports: Number,
    toWallet: String,
    memo: String,            // same as orderId
    txSig: String,           // once verified
    confirmedAt: Date
  },
  sealedKeyB64: String,       // encrypted-to-buyer AES key (after payment)
  deliveredAt: Date,
  createdAt: { type: Date, default: Date.now }
});

export default model('Order', OrderSchema);