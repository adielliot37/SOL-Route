import sharp from 'sharp';
import { createCanvas, loadImage } from 'canvas';

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
 * Generate preview for images
 */
async function generateImagePreview(fileBuffer: Buffer): Promise<PreviewResult> {
  const image = sharp(fileBuffer);
  const metadata = await image.metadata();

  // Generate thumbnail (max 400x400, maintain aspect ratio)
  const thumbnail = await image
    .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
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

  const canvas = createCanvas(400, 300);
  const ctx = canvas.getContext('2d');

  // Create a gradient background
  const gradient = ctx.createLinearGradient(0, 0, 400, 300);
  gradient.addColorStop(0, '#667eea');
  gradient.addColorStop(1, '#764ba2');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 400, 300);

  // Add play icon
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.beginPath();
  ctx.moveTo(150, 100);
  ctx.lineTo(150, 200);
  ctx.lineTo(250, 150);
  ctx.closePath();
  ctx.fill();

  // Add text
  ctx.fillStyle = 'white';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Video Preview', 200, 250);

  const preview = canvas.toDataURL('image/jpeg');

  return {
    preview,
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
  const canvas = createCanvas(400, 300);
  const ctx = canvas.getContext('2d');

  // Create background
  const gradient = ctx.createLinearGradient(0, 0, 400, 300);
  gradient.addColorStop(0, '#f093fb');
  gradient.addColorStop(1, '#f5576c');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 400, 300);

  // Draw audio waveform visualization
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 400; i += 10) {
    const height = Math.random() * 100 + 50;
    ctx.moveTo(i, 150 - height / 2);
    ctx.lineTo(i, 150 + height / 2);
  }
  ctx.stroke();

  // Add music note icon
  ctx.fillStyle = 'white';
  ctx.font = 'bold 60px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('🎵', 200, 80);

  // Add text
  ctx.font = 'bold 20px Arial';
  ctx.fillText('Audio File', 200, 250);

  const preview = canvas.toDataURL('image/jpeg');

  return {
    preview,
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
  const canvas = createCanvas(400, 500);
  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, 400, 500);

  // Add border
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, 360, 460);

  // Add PDF icon
  ctx.fillStyle = '#d32f2f';
  ctx.font = 'bold 80px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('📄', 200, 150);

  // Add text
  ctx.fillStyle = '#333';
  ctx.font = 'bold 24px Arial';
  ctx.fillText('PDF Document', 200, 250);

  const preview = canvas.toDataURL('image/jpeg');

  return {
    preview,
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
  const canvas = createCanvas(400, 500);
  const ctx = canvas.getContext('2d');

  // Light background
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, 400, 500);

  // Document icon
  ctx.fillStyle = '#1976d2';
  ctx.font = 'bold 80px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('📝', 200, 150);

  // Document type
  const extension = filename.split('.').pop()?.toUpperCase() || 'DOC';
  ctx.fillStyle = '#333';
  ctx.font = 'bold 24px Arial';
  ctx.fillText(`${extension} Document`, 200, 250);

  const preview = canvas.toDataURL('image/jpeg');

  return {
    preview,
    metadata: {
      format: mimeType
    }
  };
}

/**
 * Generate preview for text files
 */
async function generateTextPreview(fileBuffer: Buffer): Promise<PreviewResult> {
  const canvas = createCanvas(400, 500);
  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, 400, 500);

  // Show first few lines of text
  const text = fileBuffer.toString('utf-8', 0, 500);
  const lines = text.split('\n').slice(0, 15);

  ctx.fillStyle = '#333';
  ctx.font = '14px monospace';
  ctx.textAlign = 'left';
  lines.forEach((line, i) => {
    ctx.fillText(line.substring(0, 50), 20, 30 + i * 20);
  });

  const preview = canvas.toDataURL('image/jpeg');

  return {
    preview,
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
  const canvas = createCanvas(400, 400);
  const ctx = canvas.getContext('2d');

  // Gray background
  ctx.fillStyle = '#9e9e9e';
  ctx.fillRect(0, 0, 400, 400);

  // File icon
  ctx.fillStyle = 'white';
  ctx.font = 'bold 100px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('📁', 200, 150);

  // Filename
  ctx.font = 'bold 18px Arial';
  const displayName = filename.length > 30 ? filename.substring(0, 27) + '...' : filename;
  ctx.fillText(displayName, 200, 250);

  // File type
  const extension = filename.split('.').pop()?.toUpperCase() || 'FILE';
  ctx.font = '16px Arial';
  ctx.fillText(extension, 200, 280);

  const preview = canvas.toDataURL('image/jpeg');

  return {
    preview,
    metadata: {
      format: mimeType || 'unknown'
    }
  };
}
