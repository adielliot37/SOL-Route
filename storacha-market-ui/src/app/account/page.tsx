'use client'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import bs58 from 'bs58'
import { api, buildApiUrl } from '@/lib/api'
import { openSealedKeyB64 } from '@/lib/crypto'

interface PurchaseHistory {
  orderId: string
  listingId: {
    _id: string
    filename: string
    cid: string
    mime?: string
    sellerWallet: string
    createdAt: string
  }
  purchasedAt: string
  filename: string
  pricePaid: number
}

interface Purchase {
  orderId: string
  buyerWallet: string
  status: string
  paidAt: string
  deliveredAt?: string
  txSig?: string
}

interface Listing {
  _id: string
  name: string
  description: string
  filename: string
  priceLamports: number
  createdAt: string
  purchases: Purchase[]
}

interface User {
  wallet: string
  signatureVerified: boolean
  createdAt?: string
}

export default function AccountPage() {
  const { connected, publicKey, signMessage, disconnect } = useWallet()
  const { setVisible } = useWalletModal()
  const { showToast } = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistory[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingListings, setLoadingListings] = useState(false)
  const [verifying] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [autoVerifying, setAutoVerifying] = useState(false)

  const loadPurchaseHistory = useCallback(async () => {
    if (!publicKey) return

    setLoading(true)
    try {
      const response = await fetch(buildApiUrl(`/api/auth/purchase-history/${publicKey.toBase58()}`))
      if (response.ok) {
        const data = await response.json()
        setPurchaseHistory(data.purchaseHistory)
      }
    } catch {
      // Silent fail for purchase history loading
    } finally {
      setLoading(false)
    }
  }, [publicKey])

  const autoVerifyWallet = useCallback(async () => {
    if (!publicKey || !signMessage || autoVerifying || verifying) return

    setAutoVerifying(true)
    try {
      // Check if user exists to determine message type
      const checkResponse = await fetch(buildApiUrl(`/api/auth/check-user/${publicKey.toBase58()}`))
      const checkData = await checkResponse.ok ? await checkResponse.json() : { exists: false }
      
      // Use different messages for registration vs login
      const isNewUser = !checkData.exists
      const message = isNewUser
        ? `Welcome to Storacha Market! Sign this message to create your account. Timestamp: ${Date.now()}`
        : `Sign in to Storacha Market. Timestamp: ${Date.now()}`
      
      const messageBytes = new TextEncoder().encode(message)
      const signature = await signMessage(messageBytes)

      const response = await fetch(buildApiUrl(`/api/auth/verify-wallet`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: publicKey.toBase58(),
          message,
          signature: bs58.encode(signature),
          isLogin: !isNewUser
        })
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
        loadPurchaseHistory()
        if (data.isNewUser) {
          showToast('Account created successfully!', 'success')
        } else {
          showToast('Signed in successfully!', 'success')
        }
      } else {
        const error = await response.json()
        showToast(`Authentication failed: ${error.error || 'Unknown error'}`, 'error')
      }
    } catch (error) {
      const err = error as Error
      // Don't show error if user cancelled
      if (err.message?.includes('User rejected') || err.message?.includes('User cancelled')) {
        return
      }
      showToast('Authentication failed. Please try again.', 'error')
    } finally {
      setAutoVerifying(false)
    }
  }, [publicKey, signMessage, autoVerifying, verifying, loadPurchaseHistory, showToast])

  const loadUserProfile = useCallback(async () => {
    if (!publicKey) return

    try {
      const response = await fetch(buildApiUrl(`/api/auth/profile/${publicKey.toBase58()}`))
      if (response.ok) {
        const data = await response.json()
        setUser({
          wallet: data.wallet,
          signatureVerified: data.signatureVerified,
          createdAt: data.createdAt
        })
        // If user exists but not verified, trigger auto-verify
        if (!data.signatureVerified && signMessage && !autoVerifying && !verifying) {
          setTimeout(() => autoVerifyWallet(), 500) // Small delay to avoid race conditions
        }
      } else if (response.status === 404 || response.status === 504) {
        // User doesn't exist, trigger auto-verify for registration
        if (signMessage && !autoVerifying && !verifying) {
          setTimeout(() => autoVerifyWallet(), 500) // Small delay to avoid race conditions
        }
      }
    } catch {
      // If profile load fails, try to verify anyway (might be new user)
      if (signMessage && !autoVerifying && !verifying) {
        setTimeout(() => autoVerifyWallet(), 500)
      }
    }
  }, [publicKey, signMessage, autoVerifying, verifying, autoVerifyWallet])

  const loadUserListings = useCallback(async () => {
    if (!publicKey) return

    setLoadingListings(true)
    try {
      const response = await fetch(buildApiUrl(`/api/listings/seller/${publicKey.toBase58()}`))
      if (response.ok) {
        const data = await response.json()
        setListings(data)
      }
    } catch {
      // Silent fail for listings loading
    } finally {
      setLoadingListings(false)
    }
  }, [publicKey])

  const handleDisconnect = async () => {
    if (!publicKey) return

    try {
      await fetch(buildApiUrl(`/api/auth/disconnect`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: publicKey.toBase58() })
      })

      disconnect()
      setUser(null)
      setPurchaseHistory([])
      setListings([])
    } catch {
      // Silent fail for disconnect
    }
  }

  const downloadPurchase = async (purchase: PurchaseHistory) => {
    if (!publicKey) return

    setDownloadingId(purchase.listingId._id)
    try {
      // Get the delivery data (sealed key)
      const checkResp = await api.get(`/purchase/check/${purchase.listingId._id}/${publicKey.toBase58()}`)

      if (!checkResp.data.purchased) {
        showToast('Purchase not found. Please contact support.', 'error')
        return
      }

      const delivery = checkResp.data.delivery

      // Decrypt the sealed key
      const K = await openSealedKeyB64(delivery.sealedKeyB64)

      // Fetch the encrypted file
      const fileResp = await api.get(`/listings/${purchase.listingId._id}/file`, { timeout: 120000 })

      let base64Blob = fileResp.data.file || fileResp.data

      // Handle nested object structure from Storacha MCP
      if (typeof base64Blob === 'object' && base64Blob !== null) {
        // Try to extract the actual base64 string from nested structure
        if ('file' in base64Blob) {
          base64Blob = base64Blob.file
        } else if ('data' in base64Blob) {
          base64Blob = base64Blob.data
        } else if ('content' in base64Blob) {
          base64Blob = base64Blob.content
        }
      }

      // Ensure we have a string
      if (typeof base64Blob !== 'string') {
        throw new Error(`Expected base64 string but got ${typeof base64Blob}. Check backend response format.`)
      }

      // Clean base64 string (remove whitespace and newlines)
      base64Blob = base64Blob.replace(/\s/g, '')

      // Convert to Uint8Array
      const binaryString = atob(base64Blob)
      const enc = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        enc[i] = binaryString.charCodeAt(i)
      }

      // Extract IV, tag, ciphertext
      const iv = enc.slice(0, 12)
      const tag = enc.slice(12, 28)
      const ciphertext = enc.slice(28)

      // Decrypt - create a new Uint8Array to ensure proper ArrayBuffer type
      const KArray = new Uint8Array(K)
      const key = await crypto.subtle.importKey('raw', KArray, 'AES-GCM', false, ['decrypt'])
      const concat = (a: Uint8Array, b: Uint8Array) => {
        const o = new Uint8Array(a.length + b.length)
        o.set(a)
        o.set(b, a.length)
        return o
      }
      const pt = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv, tagLength: 128 },
        key,
        concat(ciphertext, tag)
      )

      // Download
      const blob = new Blob([pt], { type: delivery.mime || 'application/octet-stream' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = purchase.filename || delivery.filename || 'download'
      a.click()

      showToast('Dataset downloaded successfully!', 'success')
    } catch (error) {
      const err = error as Error
      showToast(`Failed to download: ${err.message}`, 'error')
    } finally {
      setDownloadingId(null)
    }
  }

  useEffect(() => {
    if (connected && publicKey) {
      // Load user profile first to check verification status
      loadUserProfile()
    }
  }, [connected, publicKey, loadUserProfile])

  // Load purchase history and listings after user is loaded
  useEffect(() => {
    if (user?.signatureVerified && connected && publicKey) {
      loadPurchaseHistory()
      loadUserListings()
    }
  }, [user?.signatureVerified, connected, publicKey, loadPurchaseHistory, loadUserListings])

  if (!connected) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold mb-6">Account</h1>
        <Card className="p-6 text-center">
          <h2 className="text-lg font-medium mb-2">Connect Your Wallet</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Please connect your wallet to view your account details and purchase history.
          </p>
          <Button onClick={() => setVisible(true)}>Connect Wallet</Button>
        </Card>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Account</h1>
          <p className="text-muted-foreground">Manage your listings and purchases</p>
        </div>
        <div className="flex items-center gap-3">
          {autoVerifying && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span>Signing in...</span>
            </div>
          )}
          <Button variant="outline" onClick={handleDisconnect} size="sm">
            Disconnect
          </Button>
        </div>
      </div>

      <Card className="p-6 mb-8 border-border/50">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Wallet Information
        </h3>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Address</p>
            <code className="block px-3 py-2 bg-muted/50 rounded text-xs break-all">
              {publicKey?.toBase58()}
            </code>
          </div>
          <div className="flex items-center justify-between pt-2 border-t">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <div className="flex items-center gap-2">
                {user?.signatureVerified ? (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">Verified</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Not Verified</span>
                  </>
                )}
              </div>
            </div>
            {user?.createdAt && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-1">Member since</p>
                <p className="text-sm font-medium">
                  {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>

      <section className="space-y-4 mb-12">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h2 className="text-xl font-semibold">My Listings</h2>
        </div>
        {loadingListings ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
              <p className="mt-3 text-sm text-muted-foreground">Loading listings...</p>
            </div>
          </div>
        ) : listings.length > 0 ? (
          <div className="grid gap-4">
            {listings.map((listing) => (
              <Card key={listing._id} className="p-5 hover:shadow-md transition-shadow border-border/50">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-lg mb-1">{listing.name}</h4>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {listing.description}
                      </p>
                    </div>
                    <div className="flex items-baseline gap-1 flex-shrink-0">
                      <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                        {(listing.priceLamports / 1_000_000_000).toFixed(3)}
                      </span>
                      <span className="text-sm font-medium text-muted-foreground">SOL</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      {listing.filename}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {new Date(listing.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {listing.purchases && listing.purchases.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {listing.purchases.length} Purchase{listing.purchases.length !== 1 ? 's' : ''}
                      </p>
                      <div className="space-y-1.5">
                        {listing.purchases.map((purchase, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs bg-muted/30 px-3 py-2 rounded">
                            <code className="font-mono">{purchase.buyerWallet?.slice(0, 8)}...{purchase.buyerWallet?.slice(-6)}</code>
                            <span className="text-muted-foreground">•</span>
                            <span className={purchase.status === 'DELIVERED' ? 'text-green-600 dark:text-green-400 font-medium' : 'text-muted-foreground'}>
                              {purchase.status}
                            </span>
                            {purchase.paidAt && (
                              <>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-muted-foreground">{new Date(purchase.paidAt).toLocaleDateString()}</span>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center border-dashed">
            <svg className="w-16 h-16 mx-auto text-muted-foreground/40 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="font-semibold mb-1">No listings yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first listing to start selling encrypted content!
            </p>
            <Button asChild>
              <Link href="/create">Create Listing</Link>
            </Button>
          </Card>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h2 className="text-xl font-semibold">My Purchases</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
              <p className="mt-3 text-sm text-muted-foreground">Loading purchases...</p>
            </div>
          </div>
        ) : purchaseHistory.length > 0 ? (
          <div className="grid gap-4">
            {purchaseHistory.map((purchase, index) => (
              <Card key={index} className="p-5 hover:shadow-md transition-shadow border-border/50">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg mb-2">{purchase.filename}</h4>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {new Date(purchase.purchasedAt).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          Seller: <code className="font-mono">{purchase.listingId?.sellerWallet?.slice(0, 6)}...{purchase.listingId?.sellerWallet?.slice(-4)}</code>
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-baseline gap-1 justify-end mb-1">
                        <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                          {(purchase.pricePaid / 1_000_000_000).toFixed(3)}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">SOL</span>
                      </div>
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">Purchased</span>
                    </div>
                  </div>

                  {/* Download Button */}
                  <Button
                    onClick={() => downloadPurchase(purchase)}
                    disabled={downloadingId === purchase.listingId?._id}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold"
                    size="sm"
                  >
                    {downloadingId === purchase.listingId?._id ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Decrypting...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Decrypt & Download
                      </span>
                    )}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center border-dashed">
            <svg className="w-16 h-16 mx-auto text-muted-foreground/40 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <h3 className="font-semibold mb-1">No purchases yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Browse the marketplace to buy your first encrypted file!
            </p>
            <Button asChild variant="outline">
              <Link href="/">Browse Marketplace</Link>
            </Button>
          </Card>
        )}
      </section>
    </main>
  )
}
