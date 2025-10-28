export interface FileMetadata {
  filename: string
  size: number
  type: string
  width?: number
  height?: number
  duration?: number
  thumbnail?: string 
  aspectRatio?: string
}


export async function generateImageThumbnail(
  file: File,
  maxWidth: number = 400,
  maxHeight: number = 400
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      const img = new Image()
      
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'))
          return
        }
        
        let width = img.width
        let height = img.height
        
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height
            height = maxHeight
          }
        }
        
        canvas.width = width
        canvas.height = height
        
        ctx.drawImage(img, 0, 0, width, height)
        
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target?.result as string
    }
    
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export async function generateVideoThumbnail(
  file: File,
  maxWidth: number = 400,
  maxHeight: number = 400
): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'))
      return
    }
    
    video.preload = 'metadata'
    video.muted = true
    
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, video.duration * 0.1)
    }
    
    video.onseeked = () => {
      let width = video.videoWidth
      let height = video.videoHeight
      
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height
          height = maxHeight
        }
      }
      
      canvas.width = width
      canvas.height = height
      
      ctx.drawImage(video, 0, 0, width, height)
      
      URL.revokeObjectURL(video.src)
      
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }
    
    video.onerror = () => {
      URL.revokeObjectURL(video.src)
      reject(new Error('Failed to load video'))
    }
    
    video.src = URL.createObjectURL(file)
  })
}

export async function extractImageMetadata(file: File): Promise<Partial<FileMetadata>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      const img = new Image()
      
      img.onload = () => {
        const aspectRatio = (img.width / img.height).toFixed(2)
        resolve({
          width: img.width,
          height: img.height,
          aspectRatio: `${img.width}:${img.height}`
        })
      }
      
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target?.result as string
    }
    
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export async function extractVideoMetadata(file: File): Promise<Partial<FileMetadata>> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    
    video.onloadedmetadata = () => {
      const aspectRatio = (video.videoWidth / video.videoHeight).toFixed(2)
      URL.revokeObjectURL(video.src)
      
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        duration: Math.round(video.duration),
        aspectRatio: `${video.videoWidth}:${video.videoHeight}`
      })
    }
    
    video.onerror = () => {
      URL.revokeObjectURL(video.src)
      reject(new Error('Failed to load video'))
    }
    
    video.src = URL.createObjectURL(file)
  })
}

export async function extractAudioMetadata(file: File): Promise<Partial<FileMetadata>> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio')
    audio.preload = 'metadata'
    
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(audio.src)
      
      resolve({
        duration: Math.round(audio.duration)
      })
    }
    
    audio.onerror = () => {
      URL.revokeObjectURL(audio.src)
      reject(new Error('Failed to load audio'))
    }
    
    audio.src = URL.createObjectURL(file)
  })
}

export async function generateFilePreview(file: File): Promise<FileMetadata> {
  const baseMetadata: FileMetadata = {
    filename: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream'
  }
  
  try {
    if (file.type.startsWith('image/')) {
      const [thumbnail, imageMetadata] = await Promise.all([
        generateImageThumbnail(file),
        extractImageMetadata(file)
      ])
      
      return {
        ...baseMetadata,
        ...imageMetadata,
        thumbnail
      }
    }
    
    if (file.type.startsWith('video/')) {
      const [thumbnail, videoMetadata] = await Promise.all([
        generateVideoThumbnail(file),
        extractVideoMetadata(file)
      ])
      
      return {
        ...baseMetadata,
        ...videoMetadata,
        thumbnail
      }
    }
    
    if (file.type.startsWith('audio/')) {
      const audioMetadata = await extractAudioMetadata(file)
      
      return {
        ...baseMetadata,
        ...audioMetadata
      }
    }
    
    return baseMetadata
  } catch (error) {
    console.error('Error generating preview:', error)
    return baseMetadata
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}
