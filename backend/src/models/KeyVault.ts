import { Schema, model } from 'mongoose';

// Stores content AES key (K) encrypted by server master key (AES-GCM wrap)
const KeyVaultSchema = new Schema({
  listingId: { type: Schema.Types.ObjectId, ref: 'Listing', unique: true },
  encKeyB64: { type: String, required: true },
  ivB64: { type: String, default: '' }, // Empty when using KMS (KMS handles IV internally)
  tagB64: { type: String, default: '' }, // Empty when using KMS (KMS handles auth internally)
  keyVersion: { type: Number, default: 0 }, // 0 = legacy/fallback, 1+ = KMS versions
  createdAt: { type: Date, default: Date.now },
  rotatedAt: { type: Date } // Track when key was last rotated
});

export default model('KeyVault', KeyVaultSchema);
