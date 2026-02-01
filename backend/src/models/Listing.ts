import { Schema, model } from 'mongoose';

const ListingSchema = new Schema({
  sellerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  sellerWallet: { type: String, required: true, index: true },
  cid: { type: String, required: true, index: true },
  filename: String,
  name: { type: String, required: true },
  description: { type: String, required: true },
  preview: String,
  thumbnailCid: String,
  mime: String,
  size: Number,
  priceLamports: { type: Number, required: true, index: true },

  dataSource: { type: String, index: true },
  dataType: { type: String, index: true },
  anonymized: { type: Boolean, default: false, index: true },
  recordCount: Number,
  timeRange: {
    start: Date,
    end: Date
  },
  geographicScope: String,

  euDataActCompliant: { type: Boolean, default: true, index: true },
  ownershipProof: { type: String, index: true },
  dataAccessTerms: String,
  consentRequired: { type: Boolean, default: true },
  consentLog: [{
    timestamp: { type: Date, default: Date.now },
    action: String,
    wallet: String,
    ipAddress: String
  }],
  withdrawalEnabled: { type: Boolean, default: true },
  withdrawnAt: Date,
  withdrawnReason: String,

  metadata: {
    width: Number,
    height: Number,
    duration: Number,
    pages: Number,
    format: String,
    hasAudio: Boolean,
    codec: String,
    columns: [String],
    schema: Schema.Types.Mixed
  },

  avgRating: { type: Number, default: 0, min: 0, max: 5, index: true },
  reviewCount: { type: Number, default: 0, min: 0 },

  createdAt: { type: Date, default: Date.now, index: true }
});

// Compound indexes for common queries
ListingSchema.index({ sellerWallet: 1, createdAt: -1 });
ListingSchema.index({ createdAt: -1 });
ListingSchema.index({ priceLamports: 1, createdAt: -1 });
ListingSchema.index({ euDataActCompliant: 1, withdrawnAt: 1 });
ListingSchema.index({ withdrawalEnabled: 1, withdrawnAt: 1 });

export default model('Listing', ListingSchema);