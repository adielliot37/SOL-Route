export const MAX_FILE_SIZE = 50 * 1024 * 1024

export const SUPPORTED_MIME_TYPES = [
  'text/csv',
  'application/json',
  'application/x-parquet',
  'application/vnd.apache.parquet',
  'application/x-ndjson',
  'application/x-jsonlines',
  'text/tab-separated-values',
  'application/xml',
  'text/xml',
  'application/x-hdf5',
  'application/x-h5',
  'application/x-feather',
  'application/x-arrow',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/zip',
  'application/x-tar',
  'application/gzip',
  'application/x-bzip2',
  'application/x-7z-compressed',
  'text/plain',
  'application/pdf',
  'application/octet-stream',
]

export const SUPPORTED_EXTENSIONS = [
  'csv', 'json', 'jsonl', 'ndjson', 'parquet', 'feather', 'arrow', 'h5', 'hdf5',
  'tsv', 'xls', 'xlsx', 'ods',
  'zip', 'tar', 'gz', 'bz2', '7z',
  'txt', 'xml', 'pdf',
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
      error: `Dataset size exceeds the maximum limit of 50MB. Dataset size: ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB`,
    }
  }

  if (mimeType && !SUPPORTED_MIME_TYPES.includes(mimeType)) {
    const ext = filename.split('.').pop()?.toLowerCase()
    if (!ext || !SUPPORTED_EXTENSIONS.includes(ext)) {
      return {
        valid: false,
        error: `Dataset format not supported. Supported formats: CSV, JSON, Parquet, Excel, TSV, and compressed archives.`,
      }
    }
  }

  return { valid: true }
}


