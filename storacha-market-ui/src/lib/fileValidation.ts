// Supported file types based on encryption system capabilities
// AES-256-GCM can encrypt any binary data, but we limit to common file types
// that can be properly handled by the preview system

export const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB in bytes

export const SUPPORTED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/svg+xml',
  'image/x-icon',
  // Videos
  'video/mp4',
  'video/mpeg',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-ms-wmv',
  'video/webm',
  'video/x-matroska',
  // Audio
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/flac',
  'audio/aac',
  'audio/x-m4a',
  'audio/x-ms-wma',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/vnd.oasis.opendocument.text', // .odt
  'application/vnd.oasis.opendocument.spreadsheet', // .ods
  'application/vnd.oasis.opendocument.presentation', // .odp
  // Archives
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/x-tar',
  'application/gzip',
  'application/x-bzip2',
  // Text files
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
  'text/xml',
  'application/json',
  'application/xml',
  'text/yaml',
  'text/x-yaml',
  // Code files
  'text/javascript',
  'application/javascript',
  'text/typescript',
  'application/typescript',
  'text/x-python',
  'text/x-java-source',
  'text/x-c++',
  'text/x-c',
  'text/x-go',
  'text/x-rust',
  'application/x-php',
  'text/x-ruby',
  'text/x-swift',
  'text/x-kotlin',
  // Generic binary
  'application/octet-stream',
]

export const SUPPORTED_EXTENSIONS = [
  // Images
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico',
  // Videos
  'mp4', 'mpeg', 'mov', 'avi', 'wmv', 'webm', 'mkv',
  // Audio
  'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma',
  // Documents
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp',
  // Archives
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2',
  // Text
  'txt', 'md', 'csv', 'html', 'xml', 'json', 'yaml', 'yml', 'log',
  // Code
  'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'go', 'rs', 'php', 'rb', 'swift', 'kt',
]

export interface FileValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validate file type and size
 */
export function validateFile(file: File): FileValidationResult {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds the maximum limit of 5MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`,
    }
  }

  // Check MIME type
  if (file.type && !SUPPORTED_MIME_TYPES.includes(file.type)) {
    // Fallback to extension check if MIME type is not recognized
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !SUPPORTED_EXTENSIONS.includes(ext)) {
      return {
        valid: false,
        error: `File type not supported. Supported types: Images, Videos, Audio, Documents (PDF, Word, Excel, etc.), Archives, Text files, and Code files.`,
      }
    }
  }

  return { valid: true }
}

/**
 * Get human-readable list of supported file types
 */
export function getSupportedFileTypesDescription(): string {
  return 'Images, Videos, Audio, Documents (PDF, Word, Excel, PowerPoint), Archives (ZIP, RAR, etc.), Text files, Code files'
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

