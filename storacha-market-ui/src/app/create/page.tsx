'use client'
import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CATEGORIES, getCategoryFromFilename, getCategoryFromMimeType } from '@/lib/categories'
import { Category } from '@/types'
import { generateFilePreview, formatFileSize, formatDuration, FileMetadata } from '@/lib/file-preview'

export default function CreatePage() {
  const { publicKey } = useWallet()
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [preview, setPreview] = useState<string>('')
  const [price, setPrice] = useState<string>('0.01') // SOL
  const [category, setCategory] = useState<Category>(Category.OTHER)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [fileMetadata, setFileMetadata] = useState<FileMetadata | null>(null)
  const [generatingPreview, setGeneratingPreview] = useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null
    setFile(selectedFile)
    setFileMetadata(null)
    
    if (selectedFile) {
      const detectedCategory = getCategoryFromMimeType(selectedFile.type) || getCategoryFromFilename(selectedFile.name)
      setCategory(detectedCategory)
      
      setGeneratingPreview(true)
      try {
        const metadata = await generateFilePreview(selectedFile)
        setFileMetadata(metadata)
      } catch (error) {
        console.error('Failed to generate preview:', error)
      } finally {
        setGeneratingPreview(false)
      }
    }
  }

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  async function onSubmit() {
    if (!file || !publicKey || !name || !description) {
      alert('Please fill in all required fields')
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
        thumbnail: fileMetadata?.thumbnail || undefined,
        metadata: fileMetadata ? {
          width: fileMetadata.width,
          height: fileMetadata.height,
          duration: fileMetadata.duration,
          aspectRatio: fileMetadata.aspectRatio
        } : undefined,
        mime: file.type || 'application/octet-stream',
        base64File,
        priceLamports,
        category,
        tags
      })
      alert(`Listing created successfully! CID: ${r.data.cid}`)

      // Reset form
      setFile(null)
      setName('')
      setDescription('')
      setPreview('')
      setPrice('0.01')
      setCategory(Category.OTHER)
      setTags([])
      setTagInput('')
      setFileMetadata(null)
    } catch (error: any) {
      alert(`Failed to create listing: ${error.message}`)
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
            className="mt-2 bg-black/40 border-purple-500/30 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-purple-600 file:text-white file:font-semibold hover:file:bg-purple-500"
          />
          {file && (
            <p className="text-xs text-purple-400/80 mt-2">
              Selected: {file.name} ({formatFileSize(file.size)})
            </p>
          )}
          
          {generatingPreview && (
            <div className="mt-4 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-purple-300">
                <div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                <span className="text-sm">Generating preview...</span>
              </div>
            </div>
          )}
          
          {fileMetadata && !generatingPreview && (
            <div className="mt-4 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg space-y-3">
              <h3 className="text-sm font-semibold text-purple-300">File Preview & Metadata</h3>
              
              {fileMetadata.thumbnail && (
                <div className="relative aspect-video bg-black/40 rounded overflow-hidden">
                  <img 
                    src={fileMetadata.thumbnail} 
                    alt="Preview" 
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-black/40 p-2 rounded">
                  <div className="text-purple-400/60">Type</div>
                  <div className="text-purple-300 font-mono">{fileMetadata.type}</div>
                </div>
                
                <div className="bg-black/40 p-2 rounded">
                  <div className="text-purple-400/60">Size</div>
                  <div className="text-purple-300 font-mono">{formatFileSize(fileMetadata.size)}</div>
                </div>
                
                {fileMetadata.width && fileMetadata.height && (
                  <div className="bg-black/40 p-2 rounded">
                    <div className="text-purple-400/60">Dimensions</div>
                    <div className="text-purple-300 font-mono">{fileMetadata.width} × {fileMetadata.height}</div>
                  </div>
                )}
                
                {fileMetadata.duration && (
                  <div className="bg-black/40 p-2 rounded">
                    <div className="text-purple-400/60">Duration</div>
                    <div className="text-purple-300 font-mono">{formatDuration(fileMetadata.duration)}</div>
                  </div>
                )}
                
                {fileMetadata.aspectRatio && (
                  <div className="bg-black/40 p-2 rounded">
                    <div className="text-purple-400/60">Aspect Ratio</div>
                    <div className="text-purple-300 font-mono">{fileMetadata.aspectRatio}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="category" className="text-sm font-semibold text-purple-300">
            Category <span className="text-red-400">*</span>
          </Label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="mt-2 w-full px-3 py-2 bg-black/40 border border-purple-500/30 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id} className="bg-black text-white">
                {cat.icon} {cat.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-purple-400/60 mt-2">
            Category auto-detected from file type. You can change it if needed.
          </p>
        </div>

        <div>
          <Label htmlFor="tags" className="text-sm font-semibold text-purple-300">
            Tags (optional)
          </Label>
          <div className="mt-2 flex gap-2">
            <Input
              id="tags"
              placeholder="Add a tag..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              className="flex-1 bg-black/40 border-purple-500/30 text-white placeholder:text-gray-500"
            />
            <Button
              type="button"
              onClick={addTag}
              className="px-4 bg-purple-600 hover:bg-purple-500"
            >
              Add
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded text-xs font-mono text-purple-300"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:text-white"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-purple-400/60 mt-2">
            Add relevant tags to help buyers find your content
          </p>
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