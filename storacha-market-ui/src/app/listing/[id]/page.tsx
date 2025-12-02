'use client'
import { api } from '@/lib/api'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getOrCreateX25519, openSealedKeyB64, hasStoredKeys, refreshKeyExpiry, getTimeUntilExpiry } from '@/lib/cryptoSecure'
import { obfuscateFilename, detectFileType, formatFileSize } from '@/lib/fileUtils'
import PasswordDialog from '@/components/PasswordDialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey, Transaction, SystemProgram, TransactionInstruction } from '@solana/web3.js'

export default function ListingDetail() {
  const { id } = useParams() as { id: string }
  const { publicKey, sendTransaction } = useWallet()
  const { connection } = useConnection()
  const { showToast } = useToast()
  const [listing, setListing] = useState<any>(null)
  const [order, setOrder] = useState<any>(null)
  const [delivery, setDelivery] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [paymentSending, setPaymentSending] = useState(false)
  const [checkingPurchase, setCheckingPurchase] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [passwordAction, setPasswordAction] = useState<'purchase' | 'decrypt' | null>(null)
  const [userPassword, setUserPassword] = useState<string | null>(null)

  useEffect(() => {
    api.get(`/listings/${id}`).then(r=>setListing(r.data))
  }, [id])
  useEffect(() => {
    async function checkExistingPurchase() {
      if (!publicKey || !id) return

      setCheckingPurchase(true)
      try {
        const response = await api.get(`/purchase/check/${id}/${publicKey.toBase58()}`)
        if (response.data.purchased) {
        setDelivery(response.data.delivery)
        }
      } catch (error) {
      } finally {
        setCheckingPurchase(false)
      }
    }

    checkExistingPurchase()
  }, [id, publicKey])

  const isOwnListing = listing && publicKey && listing.sellerWallet === publicKey.toBase58()

  async function startPurchase() {
    if (!publicKey) {
      showToast('Please connect your wallet first', 'error')
      return
    }

    setPasswordAction('purchase')
    setShowPasswordDialog(true)
  }

  async function handlePasswordSubmit(password: string) {
    setShowPasswordDialog(false)
    setUserPassword(password)
    
    if (passwordAction === 'purchase') {
      await executePurchase(password)
    } else if (passwordAction === 'decrypt') {
      await executeDecrypt(password)
    }
  }

  async function executePurchase(password: string) {
    setLoading(true)
    try {
      const { pubB64 } = await getOrCreateX25519(password)
      const r = await api.post('/purchase/init', {
        listingId: id,
        buyerEncPubKeyB64: pubB64,
        buyerWallet: publicKey!.toBase58()
      })
      setOrder(r.data)
      refreshKeyExpiry()
    } catch (error: any) {
      if (error.message?.includes('Invalid password')) {
        showToast('Invalid password. Please try again.', 'error')
        setPasswordAction('purchase')
        setShowPasswordDialog(true)
      } else {
        showToast('Failed to initialize purchase', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  async function sendPaymentWithMemo() {
    if (!publicKey || !order) return

    // Confirmation before payment
    const confirmed = window.confirm(
      `Send ${(order.lamports / 1_000_000_000).toFixed(3)} SOL to complete purchase?\n\n` +
      `Recipient: ${order.payTo.substring(0, 8)}...${order.payTo.substring(order.payTo.length - 8)}\n` +
      `Order ID: ${order.memo}`
    )
    if (!confirmed) return

    setPaymentSending(true)
    try {
      const transaction = new Transaction()
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(order.payTo),
          lamports: order.lamports,
        })
      )

      const memoProgram = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')
      transaction.add(
        new TransactionInstruction({
          keys: [],
          programId: memoProgram,
          data: Buffer.from(order.memo, 'utf-8'),
        })
      )

      const signature = await sendTransaction(transaction, connection)
      await connection.confirmTransaction(signature, 'confirmed')

      showToast(`Payment sent! Transaction: ${signature.substring(0, 8)}... Now click "Verify & Deliver" to get your file.`, 'success')
      
      // Auto-verify after a short delay
      setTimeout(() => {
        verify()
      }, 2000)
    } catch (error: any) {
      if (error.message?.includes('User rejected')) {
        showToast('Payment cancelled by user', 'info')
      } else {
        showToast(`Payment failed: ${error.message || 'Unknown error'}`, 'error')
      }
    } finally {
      setPaymentSending(false)
    }
  }

  async function verify() {
    if (!order) {
      showToast('No order found. Please initiate purchase first.', 'error')
      return
    }
    
    setLoading(true)
    try {
      const r = await api.post('/delivery/verify-and-deliver', { orderId: order.orderId })
      if (r.data.ok) {
        setDelivery(r.data)
        showToast('Payment verified! You can now decrypt and download your file.', 'success')
      } else {
        showToast('Payment not found yet. Please wait a moment and try again.', 'warning')
      }
    } catch (error: any) {
      if (error.response?.status === 400 && error.response?.data?.error?.includes('already used')) {
        showToast('This transaction was already processed. Checking delivery...', 'warning')
        // Try to fetch delivery again
        try {
          const checkResp = await api.get(`/purchase/check/${id}/${publicKey?.toBase58()}`)
          if (checkResp.data.purchased) {
            setDelivery(checkResp.data.delivery)
            showToast('Payment already verified! You can decrypt and download.', 'success')
          }
        } catch (e) {
          // Ignore
        }
      } else {
        showToast(`Failed to verify payment: ${error.response?.data?.error || error.message || 'Unknown error'}`, 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  async function decryptAndDownload() {
    // Check if we need to prompt for password
    if (!userPassword || getTimeUntilExpiry() === 0) {
      setPasswordAction('decrypt')
      setShowPasswordDialog(true)
      return
    }
    
    await executeDecrypt(userPassword)
  }

  async function executeDecrypt(password: string) {
    setLoading(true)
    try {
      const K = await openSealedKeyB64(
        delivery.sealedKeyB64, 
        delivery.ephemeralPubB64,
        password
      )
      refreshKeyExpiry()
      const resp = await api.get(`/listings/${id}/file`, { timeout: 120000 })

      let base64Blob = resp.data.file || resp.data

      if (typeof base64Blob === 'object' && base64Blob !== null) {
        if ('file' in base64Blob) {
          base64Blob = base64Blob.file
        } else if ('data' in base64Blob) {
          base64Blob = base64Blob.data
        } else if ('content' in base64Blob) {
          base64Blob = base64Blob.content
        }
      }

      if (typeof base64Blob !== 'string') {
        throw new Error(`Expected base64 string but got ${typeof base64Blob}. Check backend response format.`)
      }

      base64Blob = base64Blob.replace(/\s/g, '')
      let enc: Uint8Array
      try {
        const binaryString = atob(base64Blob)
        enc = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          enc[i] = binaryString.charCodeAt(i)
        }
      } catch (e) {
        throw new Error('Failed to decode base64 data. The file might be corrupted.')
      }

      const iv = enc.slice(0, 12)
      const tag = enc.slice(12, 28)
      const ciphertext = enc.slice(28)
      const key = await crypto.subtle.importKey('raw', K, 'AES-GCM', false, ['decrypt'])
      const pt = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv, tagLength: 128 },
        key,
        concat(ciphertext, tag)
      )

      const blob = new Blob([pt], { type: delivery.mime || 'application/octet-stream' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = delivery.filename || 'decrypted-file'
      a.click()

      showToast('File decrypted and downloaded successfully!', 'success')
    } catch (error: any) {
      if (error.message?.includes('Invalid password')) {
        showToast('Invalid password. Please try again.', 'error')
        setUserPassword(null)
        setPasswordAction('decrypt')
        setShowPasswordDialog(true)
      } else {
        showToast(`Failed to decrypt and download file: ${error.message}`, 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  function concat(a: Uint8Array, b: Uint8Array) {
    const o = new Uint8Array(a.length+b.length); o.set(a); o.set(b, a.length); return o
  }

  if (!listing) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
            <p className="mt-4 text-muted-foreground">Loading listing...</p>
          </div>
        </div>
      </main>
    )
  }

  const priceSOL = (listing.priceLamports / 1_000_000_000).toFixed(3)
  const amountSOL = order ? (order.lamports / 1_000_000_000).toFixed(3) : '0'

  return (
    <>
      {showPasswordDialog && (
        <PasswordDialog
          onSubmit={handlePasswordSubmit}
          onCancel={() => setShowPasswordDialog(false)}
          title={hasStoredKeys() ? 'Enter Password' : 'Create Password'}
          description={hasStoredKeys() ? 'Enter your password to unlock your keys' : 'Create a password to protect your encryption keys'}
          isCreating={!hasStoredKeys()}
        />
      )}
      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="overflow-hidden">
            <div className="aspect-video bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 dark:from-indigo-500/20 dark:via-purple-500/20 dark:to-pink-500/20 flex items-center justify-center">
              {listing.preview ? (
                <img src={listing.preview} alt={listing.name} className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <svg className="w-20 h-20 text-muted-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="text-sm text-muted-foreground font-medium">Encrypted Content</span>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h1 className="text-3xl font-bold mb-4">{listing.name || listing.filename}</h1>
            {listing.description && (
              <p className="text-muted-foreground leading-relaxed mb-6">
                {listing.description}
              </p>
            )}
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">File Type:</span>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: detectFileType(listing.mime, listing.filename).bgColor }}>
                  <span className="text-2xl">{detectFileType(listing.mime, listing.filename).icon}</span>
                  <span className="font-medium" style={{ color: detectFileType(listing.mime, listing.filename).color }}>
                    {detectFileType(listing.mime, listing.filename).type.toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Filename:</span>
                <code className="px-2 py-1 bg-muted rounded text-xs font-mono">
                  {obfuscateFilename(listing.filename)}
                </code>
              </div>
              {listing.size && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Size:</span>
                  <span className="px-2 py-1 bg-muted rounded text-xs">
                    {formatFileSize(listing.size)}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Seller:</span>
                <code className="px-2 py-1 bg-muted rounded text-xs">
                  {listing.sellerWallet?.slice(0, 8)}...{listing.sellerWallet?.slice(-8)}
                </code>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-6 space-y-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Price</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                  {priceSOL}
                </span>
                <span className="text-lg font-semibold text-muted-foreground">SOL</span>
              </div>
            </div>

            {!order && !delivery && (
              <>
                {isOwnListing ? (
                  <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg text-center">
                    <svg className="w-12 h-12 mx-auto text-purple-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-purple-300 font-mono text-sm">
                      THIS IS YOUR LISTING
                    </p>
                    <p className="text-purple-400/60 text-xs mt-1">
                      You cannot purchase your own item
                    </p>
                  </div>
                ) : (
                  <Button
                    onClick={startPurchase}
                    disabled={loading || !publicKey}
                    className="w-full h-12 text-base font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
                    size="lg"
                  >
                    {loading ? 'Processing...' : !publicKey ? 'Connect Wallet to Purchase' : 'Purchase Now'}
                  </Button>
                )}
              </>
            )}

            {order && !delivery && (
              <div className="space-y-4">
                <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg space-y-3">
                  <h3 className="font-semibold text-sm text-purple-300 font-mono">PAYMENT READY</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-purple-400/60 mb-1 text-xs font-mono">Amount:</p>
                      <p className="font-bold text-xl text-white">{amountSOL} SOL</p>
                    </div>
                    <div>
                      <p className="text-purple-400/60 mb-1 text-xs font-mono">Order ID:</p>
                      <code className="block px-3 py-2 bg-black/40 rounded text-xs break-all text-purple-300 font-mono">
                        {order.memo}
                      </code>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={sendPaymentWithMemo}
                  disabled={paymentSending}
                  className="w-full h-12 text-base font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
                  size="lg"
                >
                  {paymentSending ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      SENDING PAYMENT...
                    </span>
                  ) : (
                    'PAY NOW →'
                  )}
                </Button>

                <Button
                  onClick={verify}
                  disabled={loading}
                  className="w-full h-12 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 font-mono"
                  variant="outline"
                >
                  {loading ? 'VERIFYING...' : "VERIFY & DELIVER →"}
                </Button>

                <p className="text-xs text-purple-400/50 text-center font-mono">
                  Click "PAY NOW" to send payment with memo automatically
                </p>
              </div>
            )}

            {delivery && (
              <div className="space-y-4">
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <h3 className="font-semibold text-green-600 dark:text-green-400">Payment Verified!</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Your payment has been confirmed. You can now decrypt and download your file.
                  </p>
                </div>
                <Button
                  onClick={decryptAndDownload}
                  disabled={loading}
                  className="w-full h-12 text-base font-semibold"
                  size="lg"
                >
                  {loading ? 'Decrypting...' : 'Decrypt & Download'}
                </Button>
              </div>
            )}
          </Card>
        </div>
        </div>
      </main>
    </>
  )
}
