import sharp from 'sharp';

interface PreviewResult {
  preview: string; // base64 encoded thumbnail
  metadata: {
    width?: number;
    height?: number;
    duration?: number;
    pages?: number;
    format?: string;
    hasAudio?: boolean;
    codec?: string;
  };
}

/**
 * Generate a thumbnail preview and extract metadata from a file buffer
 */
export async function generatePreview(
  fileBuffer: Buffer,
  mimeType: string,
  filename: string
): Promise<PreviewResult> {
  const type = mimeType?.split('/')[0];

  try {
    switch (type) {
      case 'image':
        return await generateImagePreview(fileBuffer);
      case 'video':
        return await generateVideoPreview(fileBuffer, mimeType);
      case 'audio':
        return await generateAudioPreview(fileBuffer);
      case 'application':
        if (mimeType.includes('pdf')) {
          return await generatePdfPreview(fileBuffer);
        }
        return await generateDocumentPreview(filename, mimeType);
      case 'text':
        return await generateTextPreview(fileBuffer);
      default:
        return await generateGenericPreview(filename, mimeType);
    }
  } catch (error) {
    console.error('Preview generation error:', error);
    // Return a generic preview on error
    return await generateGenericPreview(filename, mimeType);
  }
}

/**
 * Generate preview for images with heavy blur
 */
async function generateImagePreview(fileBuffer: Buffer): Promise<PreviewResult> {
  const image = sharp(fileBuffer);
  const metadata = await image.metadata();

  // Generate heavily blurred thumbnail (max 400x400, maintain aspect ratio)
  const thumbnail = await image
    .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
    .blur(50) // Heavy blur to prevent unauthorized use
    .modulate({ brightness: 0.8 }) // Slightly darken
    .jpeg({ quality: 60 }) // Lower quality
    .toBuffer();

  return {
    preview: `data:image/jpeg;base64,${thumbnail.toString('base64')}`,
    metadata: {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format
    }
  };
}

/**
 * Generate preview for videos
 * Note: This is a placeholder. For production, you'd want to use ffmpeg
 * to extract a frame from the video
 */
async function generateVideoPreview(
  fileBuffer: Buffer,
  mimeType: string
): Promise<PreviewResult> {
  // In production, you'd use something like:
  // - fluent-ffmpeg to extract metadata and first frame
  // - get-video-dimensions to extract dimensions
  // For now, we'll return a placeholder

  const svg = `
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#grad1)" />
      <polygon points="150,100 150,200 250,150" fill="rgba(255,255,255,0.9)" />
      <text x="200" y="250" font-family="Arial" font-size="20" font-weight="bold" fill="white" text-anchor="middle">Video Preview</text>
    </svg>
  `;

  const preview = await sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();

  return {
    preview: `data:image/jpeg;base64,${preview.toString('base64')}`,
    metadata: {
      format: mimeType,
      // In production, extract real metadata:
      // width: videoMetadata.width,
      // height: videoMetadata.height,
      // duration: videoMetadata.duration,
      // hasAudio: videoMetadata.hasAudio,
      // codec: videoMetadata.codec
    }
  };
}

/**
 * Generate preview for audio files
 */
async function generateAudioPreview(fileBuffer: Buffer): Promise<PreviewResult> {
  const waveformBars = Array.from({ length: 40 }, (_, i) => {
    const height = Math.random() * 100 + 50;
    const x = i * 10;
    return `<line x1="${x}" y1="${150 - height / 2}" x2="${x}" y2="${150 + height / 2}" stroke="rgba(255,255,255,0.8)" stroke-width="3" />`;
  }).join('');

  const svg = `
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#f093fb;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#f5576c;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#grad2)" />
      ${waveformBars}
      <text x="200" y="80" font-family="Arial" font-size="60" font-weight="bold" fill="white" text-anchor="middle">🎵</text>
      <text x="200" y="250" font-family="Arial" font-size="20" font-weight="bold" fill="white" text-anchor="middle">Audio File</text>
    </svg>
  `;

  const preview = await sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();

  return {
    preview: `data:image/jpeg;base64,${preview.toString('base64')}`,
    metadata: {
      // In production, use a library like music-metadata to extract:
      // duration: audioMetadata.format.duration,
      // codec: audioMetadata.format.codec
    }
  };
}

/**
 * Generate preview for PDF documents
 */
async function generatePdfPreview(fileBuffer: Buffer): Promise<PreviewResult> {
  // In production, use pdf-thumbnail or pdf2pic
  const svg = `
    <svg width="400" height="500" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="500" fill="white" />
      <rect x="20" y="20" width="360" height="460" fill="none" stroke="#e0e0e0" stroke-width="2" />
      <text x="200" y="150" font-family="Arial" font-size="80" font-weight="bold" fill="#d32f2f" text-anchor="middle">📄</text>
      <text x="200" y="250" font-family="Arial" font-size="24" font-weight="bold" fill="#333" text-anchor="middle">PDF Document</text>
    </svg>
  `;

  const preview = await sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();

  return {
    preview: `data:image/jpeg;base64,${preview.toString('base64')}`,
    metadata: {
      format: 'pdf'
      // In production, extract page count using pdf-parse
    }
  };
}

/**
 * Generate preview for documents
 */
async function generateDocumentPreview(
  filename: string,
  mimeType: string
): Promise<PreviewResult> {
  const extension = (filename.split('.').pop()?.toUpperCase() || 'DOC').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  const svg = `
    <svg width="400" height="500" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="500" fill="#f5f5f5" />
      <text x="200" y="150" font-family="Arial" font-size="80" font-weight="bold" fill="#1976d2" text-anchor="middle">📝</text>
      <text x="200" y="250" font-family="Arial" font-size="24" font-weight="bold" fill="#333" text-anchor="middle">${extension} Document</text>
    </svg>
  `;

  const preview = await sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();

  return {
    preview: `data:image/jpeg;base64,${preview.toString('base64')}`,
    metadata: {
      format: mimeType
    }
  };
}

/**
 * Generate preview for text files
 */
async function generateTextPreview(fileBuffer: Buffer): Promise<PreviewResult> {
  // Show first few lines of text
  const text = fileBuffer.toString('utf-8', 0, 500).replace(/[\r\0]/g, '');
  const lines = text.split('\n').slice(0, 15);

  const textElements = lines.map((line, i) => {
    const cleaned = line.replace(/[^\x20-\x7E]/g, '')
    const escapedLine = cleaned.substring(0, 50)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<text x="20" y="${30 + i * 20}" font-family="monospace" font-size="14" fill="#333">${escapedLine}</text>`;
  }).join('');

  const svg = `
    <svg width="400" height="500" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="500" fill="white" />
      ${textElements}
    </svg>
  `;

  const preview = await sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();

  return {
    preview: `data:image/jpeg;base64,${preview.toString('base64')}`,
    metadata: {
      format: 'text'
    }
  };
}

/**
 * Generate generic preview for unsupported file types
 */
async function generateGenericPreview(
  filename: string,
  mimeType: string
): Promise<PreviewResult> {
  const rawName = filename.length > 30 ? filename.substring(0, 27) + '...' : filename;
  const displayName = rawName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const extension = (filename.split('.').pop()?.toUpperCase() || 'FILE').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  const svg = `
    <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="400" fill="#9e9e9e" />
      <text x="200" y="150" font-family="Arial" font-size="100" font-weight="bold" fill="white" text-anchor="middle">📁</text>
      <text x="200" y="250" font-family="Arial" font-size="18" font-weight="bold" fill="white" text-anchor="middle">${displayName}</text>
      <text x="200" y="280" font-family="Arial" font-size="16" fill="white" text-anchor="middle">${extension}</text>
    </svg>
  `;

  const preview = await sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();

  return {
    preview: `data:image/jpeg;base64,${preview.toString('base64')}`,
    metadata: {
      format: mimeType || 'unknown'
    }
  };
}
