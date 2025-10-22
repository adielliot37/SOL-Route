import { Schema, model } from 'mongoose';

// Stores content AES key (K) encrypted by server master key (AES-GCM wrap)
const KeyVaultSchema = new Schema({
  listingId: { type: Schema.Types.ObjectId, ref: 'Listing', unique: true },
  encKeyB64: { type: String, required: true },
  ivB64: { type: String, required: true },
  tagB64: { type: String, required: true }
});

export default model('KeyVault', KeyVaultSchema);