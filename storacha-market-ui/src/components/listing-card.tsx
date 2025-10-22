'use client'

import { Card } from '@/components/ui/card'
import Link from 'next/link'

export default function ListingCard({ item }: { item: any }) {
  const priceSOL = (item.priceLamports / 1_000_000_000).toFixed(3)

  return (
    <Link href={`/listing/${item._id}`}>
      <Card className="group overflow-hidden hover:shadow-xl hover:shadow-purple-500/20 transition-all duration-300 cursor-pointer border-purple-500/20 hover:border-purple-500/40 bg-black/40 backdrop-blur-sm">
        {/* Preview or gradient placeholder */}
        <div className="relative aspect-video bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-purple-900/20 flex items-center justify-center overflow-hidden">
          {item.preview ? (
            <>
              <img src={item.preview} alt={item.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <svg className="w-12 h-12 text-purple-500/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-xs text-purple-400/60 font-mono tracking-wider">ENCRYPTED</span>
            </div>
          )}

          {/* Overlay badge */}
          <div className="absolute top-2 right-2 px-2 py-1 bg-purple-500/20 backdrop-blur-md border border-purple-500/30 rounded text-[10px] font-mono text-purple-300">
            ONCHAIN
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Title and Description */}
          <div className="space-y-1">
            <h3 className="font-bold text-base text-white group-hover:text-purple-300 transition-colors line-clamp-1">
              {item.name || item.filename || 'UNTITLED'}
            </h3>
            {item.description && (
              <p className="text-sm text-purple-400/60 line-clamp-2">
                {item.description}
              </p>
            )}
          </div>

          {/* Price and Action */}
          <div className="flex items-center justify-between pt-2 border-t border-purple-500/10">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                {priceSOL}
              </span>
              <span className="text-xs font-mono text-purple-400/60">SOL</span>
            </div>
            <div className="px-3 py-1 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded text-xs font-mono text-purple-300 group-hover:border-purple-500/50 transition-all">
              VIEW →
            </div>
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-2 text-[10px] text-purple-400/50 font-mono pt-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span className="truncate uppercase">{item.filename}</span>
          </div>
        </div>
      </Card>
    </Link>
  )
}