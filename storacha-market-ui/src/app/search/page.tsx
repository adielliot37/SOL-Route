'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import ListingCard from '@/components/listing-card'
import SearchBar from '@/components/search-bar'
import { CATEGORIES, getCategoryInfo } from '@/lib/categories'
import { Category } from '@/types'

export default function SearchPage() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''
  const [listings, setListings] = useState<any[]>([])
  const [filteredListings, setFilteredListings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<Category | 'ALL'>('ALL')

  useEffect(() => {
    api.get('/listings')
      .then(r => {
        setListings(r.data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch listings:', err)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    let filtered = listings

    if (query) {
      const lowerQuery = query.toLowerCase()
      filtered = filtered.filter(listing => 
        listing.name?.toLowerCase().includes(lowerQuery) ||
        listing.description?.toLowerCase().includes(lowerQuery) ||
        listing.filename?.toLowerCase().includes(lowerQuery) ||
        listing.tags?.some((tag: string) => tag.toLowerCase().includes(lowerQuery))
      )
    }

    if (selectedCategory !== 'ALL') {
      filtered = filtered.filter(listing => listing.category === selectedCategory)
    }

    setFilteredListings(filtered)
  }, [listings, query, selectedCategory])

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          Search Listings
        </h1>
        <SearchBar />
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-semibold text-purple-300">Filter by Category:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-4 py-2 rounded-full text-sm font-mono transition-all ${
              selectedCategory === 'ALL'
                ? 'bg-purple-600 text-white'
                : 'bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 border border-purple-500/30'
            }`}
          >
            All
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-mono transition-all ${
                selectedCategory === cat.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 border border-purple-500/30'
              }`}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      </div>

      {query && (
        <div className="mb-6">
          <p className="text-purple-400/80 font-mono">
            {loading ? (
              'Searching...'
            ) : (
              <>
                Found <span className="text-white font-bold">{filteredListings.length}</span> result{filteredListings.length !== 1 ? 's' : ''} for "{query}"
              </>
            )}
          </p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent"></div>
            <p className="mt-4 text-purple-400/60 font-mono">LOADING...</p>
          </div>
        </div>
      )}

      {!loading && (
        <>
          {filteredListings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredListings.map((listing: any) => (
                <ListingCard key={listing._id} item={listing} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center border border-purple-500/10 rounded-2xl bg-purple-500/5">
              <svg className="w-24 h-24 text-purple-500/40 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="text-xl font-bold text-white mb-2">NO RESULTS FOUND</h3>
              <p className="text-purple-400/60 max-w-sm font-mono text-sm">
                {query ? (
                  <>Try different keywords or browse all listings</>
                ) : (
                  <>Start searching to find listings</>
                )}
              </p>
            </div>
          )}
        </>
      )}
    </main>
  )
}
