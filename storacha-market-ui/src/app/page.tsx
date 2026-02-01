'use client'
import useSWR from 'swr'
import { api } from '@/lib/api'
import ListingCard from '@/components/listing-card'

export default function Page() {
  const { data, isLoading } = useSWR('listings', () => api.get('/listings').then(r => r.data))

  return (
    <main className="mx-auto max-w-7xl">
      <div className="relative py-20 md:py-32 px-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-20 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl animate-pulse delay-700" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-full mb-8">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
            <span className="text-sm font-mono text-purple-300 tracking-wider">
              DECENTRALIZED • YOUR DATA • YOUR VALUE
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tighter">
            <span className="block text-white mb-2">MONETIZE</span>
            <span className="block bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
              YOUR DATA
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-purple-300/80 mb-4 font-light">
            Own your data. Sell access. Build the future.
          </p>
          <p className="text-lg text-purple-400/60 max-w-2xl mx-auto mb-12 font-mono">
            List your smartwatch data, IoT sensors, connected car logs, and more.<br/>
            <span className="text-purple-500/80">Decentralized storage. Automatic payments. Your ownership.</span>
          </p>

          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white mb-1">{data?.length || 0}</div>
              <div className="text-sm text-purple-400/60 font-mono">DATASETS</div>
            </div>
            <div className="text-center border-x border-purple-500/10">
              <div className="text-3xl md:text-4xl font-bold text-white mb-1">100%</div>
              <div className="text-sm text-purple-400/60 font-mono">DECENTRALIZED</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white mb-1">€270B</div>
              <div className="text-sm text-purple-400/60 font-mono">OPPORTUNITY</div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-20">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">AVAILABLE DATASETS</h2>
            <p className="text-purple-400/60 font-mono text-sm">Browse data listings</p>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent"></div>
              <p className="mt-4 text-purple-400/60 font-mono">LOADING...</p>
            </div>
          </div>
        )}

        {!isLoading && data && (
          <>
            {data.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {data.map((it: { _id: string; name?: string; filename?: string; description?: string; preview?: string; priceLamports: number }) => <ListingCard key={it._id} item={it} />)}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[400px] text-center border border-purple-500/10 rounded-2xl bg-purple-500/5">
                <svg className="w-24 h-24 text-purple-500/40 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <h3 className="text-xl font-bold text-white mb-2">NO DATASETS YET</h3>
                <p className="text-purple-400/60 max-w-sm font-mono text-sm">
                  Be the first to list your data
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}