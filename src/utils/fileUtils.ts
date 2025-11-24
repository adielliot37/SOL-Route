/**
 * Obfuscate filename by showing only first/last chars and hiding middle
 * Example: "aditya.jpg" -> "ad****pg"
 */
export function obfuscateFilename(filename: string): string {
  if (!filename || filename.length <= 4) {
    return filename;
  }

  // Split filename and extension
  const lastDotIndex = filename.lastIndexOf('.');
  const hasExtension = lastDotIndex > 0;
  
  const name = hasExtension ? filename.substring(0, lastDotIndex) : filename;
  const extension = hasExtension ? filename.substring(lastDotIndex + 1) : '';

  // Calculate how many characters to show (20-30%)
  const totalLength = name.length;
  const showChars = Math.max(2, Math.floor(totalLength * 0.25)); // Show 25% (between 20-30%)
  
  // Show first and last characters
  const firstChars = name.substring(0, showChars);
  const lastChars = name.substring(name.length - showChars);
  
  // Calculate asterisks for middle
  const hiddenLength = Math.max(2, totalLength - (showChars * 2));
  const asterisks = '*'.repeat(hiddenLength);
  
  // Handle extension
  if (hasExtension) {
    // Show first 2 chars of extension if long, else show full extension
    const extDisplay = extension.length > 3 
      ? extension.substring(0, 2) + '*'.repeat(extension.length - 2)
      : extension;
    return `${firstChars}${asterisks}${lastChars}.${extDisplay}`;
  }
  
  return `${firstChars}${asterisks}${lastChars}`;
}

/**
 * Detect file type category from MIME type or extension
 */
export function detectFileType(mimeType?: string, filename?: string): {
  type: 'image' | 'video' | 'audio' | 'document' | 'archive' | 'code' | 'text' | 'other';
  icon: string;
  color: string;
} {
  // Try to detect from MIME type first
  if (mimeType) {
    const [category] = mimeType.split('/');
    
    if (category === 'image') {
      return { type: 'image', icon: '🖼️', color: '#4CAF50' };
    }
    if (category === 'video') {
      return { type: 'video', icon: '🎬', color: '#9C27B0' };
    }
    if (category === 'audio') {
      return { type: 'audio', icon: '🎵', color: '#E91E63' };
    }
    if (category === 'text') {
      return { type: 'text', icon: '📝', color: '#2196F3' };
    }
    if (mimeType.includes('pdf')) {
      return { type: 'document', icon: '📄', color: '#F44336' };
    }
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) {
      return { type: 'archive', icon: '📦', color: '#FF9800' };
    }
    if (mimeType.includes('msword') || mimeType.includes('wordprocessing') || 
        mimeType.includes('excel') || mimeType.includes('spreadsheet') ||
        mimeType.includes('powerpoint') || mimeType.includes('presentation')) {
      return { type: 'document', icon: '📊', color: '#3F51B5' };
    }
  }

  // Fallback to extension detection
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    // Images
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'].includes(ext || '')) {
      return { type: 'image', icon: '🖼️', color: '#4CAF50' };
    }
    
    // Videos
    if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'].includes(ext || '')) {
      return { type: 'video', icon: '🎬', color: '#9C27B0' };
    }
    
    // Audio
    if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'].includes(ext || '')) {
      return { type: 'audio', icon: '🎵', color: '#E91E63' };
    }
    
    // Documents
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'].includes(ext || '')) {
      return { type: 'document', icon: '📄', color: '#F44336' };
    }
    
    // Archives
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext || '')) {
      return { type: 'archive', icon: '📦', color: '#FF9800' };
    }
    
    // Code
    if (['js', 'ts', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'php', 'rb', 'swift', 'kt'].includes(ext || '')) {
      return { type: 'code', icon: '💻', color: '#00BCD4' };
    }
    
    // Text
    if (['txt', 'md', 'json', 'xml', 'yaml', 'yml', 'csv', 'log'].includes(ext || '')) {
      return { type: 'text', icon: '📝', color: '#2196F3' };
    }
  }

  // Default
  return { type: 'other', icon: '📁', color: '#9E9E9E' };
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const ext = filename.split('.').pop();
  return ext ? ext.toUpperCase() : 'FILE';
}

/**
 * Format file size to human readable
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
