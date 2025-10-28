
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

export interface CategoryInfo {
  id: Category
  label: string
  icon: string
}

export const CATEGORIES: CategoryInfo[] = [
  { id: Category.IMAGE, label: 'Image', icon: '🖼️' },
  { id: Category.VIDEO, label: 'Video', icon: '🎬' },
  { id: Category.AUDIO, label: 'Audio', icon: '🎵' },
  { id: Category.DOCUMENT, label: 'Document', icon: '📄' },
  { id: Category.CODE, label: 'Code', icon: '💻' },
  { id: Category.ARCHIVE, label: 'Archive', icon: '📦' },
  { id: Category.MODEL_3D, label: '3D Model', icon: '🎨' },
  { id: Category.OTHER, label: 'Other', icon: '📁' }
]


export function getCategoryInfo(category: Category | string): CategoryInfo {
  const found = CATEGORIES.find(c => c.id === category)
  return found || CATEGORIES[CATEGORIES.length - 1] // Default to OTHER
}


export function getCategoryFromMimeType(mimeType: string): Category {
  if (!mimeType) return Category.OTHER

  if (mimeType.startsWith('image/')) return Category.IMAGE
  if (mimeType.startsWith('video/')) return Category.VIDEO
  if (mimeType.startsWith('audio/')) return Category.AUDIO
  
  if (mimeType.includes('pdf') || 
      mimeType.includes('document') || 
      mimeType.includes('text') ||
      mimeType.includes('word') ||
      mimeType.includes('excel') ||
      mimeType.includes('powerpoint')) {
    return Category.DOCUMENT
  }
  
  if (mimeType.includes('zip') || 
      mimeType.includes('rar') || 
      mimeType.includes('tar') ||
      mimeType.includes('7z') ||
      mimeType.includes('compressed')) {
    return Category.ARCHIVE
  }

  return Category.OTHER
}


export function getCategoryFromFilename(filename: string): Category {
  if (!filename) return Category.OTHER

  const ext = filename.split('.').pop()?.toLowerCase()
  if (!ext) return Category.OTHER

  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff', 'heic'].includes(ext)) {
    return Category.IMAGE
  }

  if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', 'm4v', 'mpg', 'mpeg'].includes(ext)) {
    return Category.VIDEO
  }

  if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus'].includes(ext)) {
    return Category.AUDIO
  }

  if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'xls', 'xlsx', 'ppt', 'pptx', 'csv'].includes(ext)) {
    return Category.DOCUMENT
  }

  if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'html', 'css', 'scss', 'json', 'xml', 'yaml', 'yml', 'md', 'sql'].includes(ext)) {
    return Category.CODE
  }

  if (['zip', 'rar', 'tar', 'gz', '7z', 'bz2', 'xz'].includes(ext)) {
    return Category.ARCHIVE
  }

  if (['obj', 'fbx', 'gltf', 'glb', 'stl', 'dae', 'blend', '3ds', 'max'].includes(ext)) {
    return Category.MODEL_3D
  }

  return Category.OTHER
}
