// Backend file validation constants
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
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
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
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico',
  'mp4', 'mpeg', 'mov', 'avi', 'wmv', 'webm', 'mkv',
  'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp',
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2',
  'txt', 'md', 'csv', 'html', 'xml', 'json', 'yaml', 'yml', 'log',
  'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'go', 'rs', 'php', 'rb', 'swift', 'kt',
]

export interface FileValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validate file size and type on backend
 */
export function validateFile(
  fileBuffer: Buffer,
  mimeType: string | undefined,
  filename: string
): FileValidationResult {
  // Check file size
  if (fileBuffer.length > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds the maximum limit of 5MB. File size: ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB`,
    }
  }

  // Check MIME type
  if (mimeType && !SUPPORTED_MIME_TYPES.includes(mimeType)) {
    // Fallback to extension check
    const ext = filename.split('.').pop()?.toLowerCase()
    if (!ext || !SUPPORTED_EXTENSIONS.includes(ext)) {
      return {
        valid: false,
        error: `File type not supported. Supported types: Images, Videos, Audio, Documents, Archives, Text files, and Code files.`,
      }
    }
  }

  return { valid: true }
}


