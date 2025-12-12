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
  'text/xml',
  'application/json',
  'application/xml',
  'text/yaml',
  'text/x-yaml',
  // Code files
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
]

export const SUPPORTED_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico',
  'mp4', 'mpeg', 'mov', 'avi', 'wmv', 'webm', 'mkv',
  'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp',
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2',
  'txt', 'md', 'csv', 'xml', 'json', 'yaml', 'yml', 'log',
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
  if (fileBuffer.length > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds the maximum limit of 5MB. File size: ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB`,
    }
  }
  const canonicalMime = mimeType ? canonicalizeMime(mimeType) : undefined
  const detectedMime = detectMimeByMagic(fileBuffer)
  const ext = filename.split('.').pop()?.toLowerCase()
  if (canonicalMime) {
    if (detectedMime && !mimeEquals(detectedMime, canonicalMime)) {
      return { valid: false, error: 'File content does not match declared type' }
    }
    if (!SUPPORTED_MIME_TYPES.includes(canonicalMime)) {
      if (!ext || !SUPPORTED_EXTENSIONS.includes(ext)) {
        return { valid: false, error: 'File type not supported' }
      }
    }
  } else {
    if (detectedMime) {
      if (!SUPPORTED_MIME_TYPES.includes(detectedMime)) {
        return { valid: false, error: 'File type not supported' }
      }
    } else {
      if (!ext || !SUPPORTED_EXTENSIONS.includes(ext)) {
        return { valid: false, error: 'File type not supported' }
      }
    }
  }
  if ((canonicalMime === 'image/svg+xml' || ext === 'svg') && !isSafeSvg(fileBuffer)) {
    return { valid: false, error: 'Unsafe SVG content' }
  }
  if (!mimeExtConsistent(canonicalMime, ext)) {
    return { valid: false, error: 'File extension does not match type' }
  }
  return { valid: true }
}

function canonicalizeMime(mime: string): string {
  if (mime === 'image/jpg') return 'image/jpeg'
  if (mime === 'audio/mp3') return 'audio/mpeg'
  return mime
}

function mimeEquals(a: string, b: string): boolean {
  return canonicalizeMime(a) === canonicalizeMime(b)
}

function detectMimeByMagic(buf: Buffer): string | undefined {
  if (buf.length < 12) return undefined
  const b = (i: number) => buf[i]
  if (b(0) === 0xFF && b(1) === 0xD8 && b(2) === 0xFF) return 'image/jpeg'
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4E && b(3) === 0x47 && b(4) === 0x0D && b(5) === 0x0A && b(6) === 0x1A && b(7) === 0x0A) return 'image/png'
  if (buf.slice(0, 6).toString('ascii') === 'GIF87a' || buf.slice(0, 6).toString('ascii') === 'GIF89a') return 'image/gif'
  if (buf.slice(0, 2).toString('ascii') === 'BM') return 'image/bmp'
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WAVE') return 'audio/wav'
  if (buf.slice(0, 4).toString('ascii') === 'OggS') return 'audio/ogg'
  if (buf.slice(0, 3).toString('ascii') === 'ID3') return 'audio/mpeg'
  if (buf.length > 12 && buf.slice(4, 8).toString('ascii') === 'ftyp') return 'video/mp4'
  if (buf.slice(0, 4).toString('ascii') === '%PDF') return 'application/pdf'
  if (buf.slice(0, 2).toString('ascii') === 'PK') return 'application/zip'
  if (b(0) === 0x1F && b(1) === 0x8B) return 'application/gzip'
  if (buf.slice(0, 4).toString('ascii') === 'Rar!') return 'application/x-rar-compressed'
  if (buf.length >= 6 && buf[0] === 0x37 && buf[1] === 0x7A && buf[2] === 0xBC && buf[3] === 0xAF && buf[4] === 0x27 && buf[5] === 0x1C) return 'application/x-7z-compressed'
  const s = buf.slice(0, 256).toString('utf-8').trim()
  if (s.startsWith('<?xml') || s.startsWith('<svg')) return 'image/svg+xml'
  return undefined
}

function isSafeSvg(buf: Buffer): boolean {
  const s = buf.slice(0, Math.min(buf.length, 4096)).toString('utf-8').toLowerCase()
  if (!s.includes('<svg')) return false
  if (s.includes('<script')) return false
  if (s.includes('onload=')) return false
  if (s.includes('onerror=')) return false
  if (s.includes('javascript:')) return false
  return true
}

function mimeExtConsistent(mime: string | undefined, ext: string | undefined): boolean {
  if (!ext) return true
  if (!mime) return true
  const map: Record<string, string | string[]> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    mpeg: 'video/mpeg',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    wmv: 'video/x-ms-wmv',
    webm: 'video/webm',
    mkv: 'video/x-matroska',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    aac: 'audio/aac',
    m4a: 'audio/x-m4a',
    wma: 'audio/x-ms-wma',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    odt: 'application/vnd.oasis.opendocument.text',
    ods: 'application/vnd.oasis.opendocument.spreadsheet',
    odp: 'application/vnd.oasis.opendocument.presentation',
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    tar: 'application/x-tar',
    gz: 'application/gzip',
    bz2: 'application/x-bzip2',
    txt: 'text/plain',
    md: 'text/markdown',
    csv: 'text/csv',
    xml: ['application/xml', 'text/xml'],
    json: 'application/json',
    yaml: ['text/yaml', 'text/x-yaml'],
    yml: ['text/yaml', 'text/x-yaml'],
    js: 'text/plain',
    ts: 'application/typescript',
    jsx: 'text/plain',
    tsx: 'application/typescript',
    py: 'text/x-python',
    java: 'text/x-java-source',
    cpp: 'text/x-c++',
    c: 'text/x-c',
    h: 'text/x-c',
    go: 'text/x-go',
    rs: 'text/x-rust',
    php: 'application/x-php',
    rb: 'text/x-ruby',
    swift: 'text/x-swift',
    kt: 'text/x-kotlin'
  }
  const expected = map[ext]
  if (!expected) return true
  if (Array.isArray(expected)) return expected.includes(mime)
  if (expected === 'application/typescript') return mime === 'application/typescript' || mime === 'text/typescript'
  return mime === expected
}
