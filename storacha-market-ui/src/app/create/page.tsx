'use client'
import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { validateFile, MAX_FILE_SIZE, getSupportedFileTypesDescription, formatFileSize, SUPPORTED_MIME_TYPES } from '@/lib/fileValidation'

export default function CreatePage() {
  const { publicKey } = useWallet()
  const { showToast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [preview, setPreview] = useState<string>('')
  const [price, setPrice] = useState<string>('0.01') // SOL
  const [loading, setLoading] = useState(false)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) {
      setFile(null)
      return
    }

    const validation = validateFile(selectedFile)
    if (!validation.valid) {
      showToast(validation.error || 'Invalid file', 'error')
      e.target.value = '' // Reset input
      setFile(null)
      return
    }

    setFile(selectedFile)
  }

  async function onSubmit() {
    if (!file || !publicKey || !name || !description) {
      showToast('Please fill in all required fields', 'error')
      return
    }

    // Validate file again before submission
    const validation = validateFile(file)
    if (!validation.valid) {
      showToast(validation.error || 'Invalid file', 'error')
      return
    }

    setLoading(true)
    try {
      const buf = await file.arrayBuffer()
      const uint8Array = new Uint8Array(buf)

      // Convert to base64 safely for large files
      let binary = ''
      const chunkSize = 8192
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize)
        binary += String.fromCharCode.apply(null, Array.from(chunk))
      }
      const base64File = btoa(binary)

      // Convert SOL to lamports
      const priceLamports = Math.floor(parseFloat(price) * 1_000_000_000)

      const r = await api.post('/listings/create', {
        sellerWallet: publicKey.toBase58(),
        filename: file.name,
        name,
        description,
        preview: preview || undefined,
        mime: file.type || 'application/octet-stream',
        base64File,
        priceLamports
      })
      showToast(`Listing created successfully! CID: ${r.data.cid}`, 'success')

      // Reset form
      setFile(null)
      setName('')
      setDescription('')
      setPreview('')
      setPrice('0.01')
      // Reset file input
      const fileInput = document.getElementById('file') as HTMLInputElement
      if (fileInput) fileInput.value = ''
    } catch (error: any) {
      showToast(`Failed to create listing: ${error.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold mb-8 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Create Listing</h1>

      <div className="space-y-6">
        <div>
          <Label htmlFor="name" className="text-sm font-semibold text-purple-300">
            Name <span className="text-red-400">*</span>
          </Label>
          <Input
            id="name"
            placeholder="Enter listing name"
            value={name}
            onChange={e => setName(e.target.value)}
            className="mt-2 bg-black/40 border-purple-500/30 text-white placeholder:text-gray-500"
          />
        </div>

        <div>
          <Label htmlFor="description" className="text-sm font-semibold text-purple-300">
            Description <span className="text-red-400">*</span>
          </Label>
          <Textarea
            id="description"
            placeholder="Describe your file"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="mt-2 bg-black/40 border-purple-500/30 text-white placeholder:text-gray-500"
            rows={4}
          />
        </div>

        <div>
          <Label htmlFor="preview" className="text-sm font-semibold text-purple-300">
            Preview URL (optional)
          </Label>
          <Input
            id="preview"
            placeholder="https://example.com/preview.jpg"
            value={preview}
            onChange={e => setPreview(e.target.value)}
            className="mt-2 bg-black/40 border-purple-500/30 text-white placeholder:text-gray-500"
          />
          <p className="text-xs text-purple-400/60 mt-2">
            Add a preview image or video URL for your listing
          </p>
        </div>

        <div>
          <Label htmlFor="file" className="text-sm font-semibold text-purple-300">
            File <span className="text-red-400">*</span>
          </Label>
          <Input
            id="file"
            type="file"
            onChange={handleFileChange}
            accept={SUPPORTED_MIME_TYPES.join(',')}
            className="mt-2 bg-black/40 border-purple-500/30 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-purple-600 file:text-white file:font-semibold hover:file:bg-purple-500"
          />
          <div className="mt-2 space-y-1">
            {file && (
              <p className="text-xs text-purple-400/80">
                Selected: {file.name} ({formatFileSize(file.size)})
              </p>
            )}
            <div className="text-xs text-purple-400/60 space-y-0.5">
              <p className="font-semibold text-purple-300/80">File Requirements:</p>
              <p>• Max file size: {formatFileSize(MAX_FILE_SIZE)}</p>
              <p>• Supported types: {getSupportedFileTypesDescription()}</p>
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor="price" className="text-sm font-semibold text-purple-300">
            Price (SOL) <span className="text-red-400">*</span>
          </Label>
          <Input
            id="price"
            type="number"
            step="0.001"
            min="0"
            placeholder="0.01"
            value={price}
            onChange={e => setPrice(e.target.value)}
            className="mt-2 bg-black/40 border-purple-500/30 text-white placeholder:text-gray-500"
          />
          <p className="text-xs text-purple-400/60 mt-2">
            {price && !isNaN(parseFloat(price))
              ? `≈ ${(parseFloat(price) * 1_000_000_000).toLocaleString()} lamports`
              : 'Enter price in SOL'}
          </p>
        </div>

        <Button
          className="w-full h-12 text-base font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50"
          onClick={onSubmit}
          disabled={loading || !file || !name || !description || !publicKey}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Creating Listing...
            </span>
          ) : !publicKey ? (
            'Connect Wallet to Create'
          ) : (
            'Create Listing'
          )}
        </Button>
      </div>
    </main>
  )
}