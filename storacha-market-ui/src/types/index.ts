export enum Category {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  DOCUMENT = 'DOCUMENT',
  CODE = 'CODE',
  ARCHIVE = 'ARCHIVE',
  MODEL_3D = 'MODEL_3D',
  OTHER = 'OTHER'
}

export interface Listing {
  _id: string
  sellerId?: string
  sellerWallet: string
  cid: string
  filename: string
  name: string
  description: string
  preview?: string
  thumbnail?: string
  mime?: string
  size?: number
  metadata?: {
    width?: number
    height?: number
    duration?: number
    aspectRatio?: string
  }
  priceLamports: number
  category?: Category
  tags?: string[]
  createdAt: Date
}

export interface Order {
  _id: string
  orderId: string
  listingId: string
  buyerWallet: string
  status: 'PENDING' | 'PAID' | 'DELIVERED' | 'CANCELLED'
  payment?: {
    txSig: string
    confirmedAt: Date
  }
  deliveredAt?: Date
  createdAt: Date
}
