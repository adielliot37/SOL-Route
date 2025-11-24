export function obfuscateFilename(filename: string): string {
  if (!filename || filename.length <= 4) {
    return filename;
  }
  const lastDotIndex = filename.lastIndexOf('.');
  const hasExtension = lastDotIndex > 0;
  
  const name = hasExtension ? filename.substring(0, lastDotIndex) : filename;
  const extension = hasExtension ? filename.substring(lastDotIndex + 1) : '';
  const totalLength = name.length;
  const showChars = Math.max(2, Math.floor(totalLength * 0.25));
  const firstChars = name.substring(0, showChars);
  const lastChars = name.substring(name.length - showChars);
  const hiddenLength = Math.max(2, totalLength - (showChars * 2));
  const asterisks = '*'.repeat(hiddenLength);
  if (hasExtension) {
    const extDisplay = extension.length > 3 ? extension.substring(0, 2) : extension;
    return `${firstChars}${asterisks}${lastChars}.${extDisplay}`;
  }
  
  return `${firstChars}${asterisks}${lastChars}`;
}

export function detectFileType(mimeType?: string, filename?: string): {
  type: 'image' | 'video' | 'audio' | 'document' | 'archive' | 'code' | 'text' | 'other';
  icon: string;
  color: string;
  bgColor: string;
} {
  if (mimeType) {
    const [category] = mimeType.split('/');
    
    if (category === 'image') {
      return { type: 'image', icon: '📷', color: '#4CAF50', bgColor: '#E8F5E9' };
    }
    if (category === 'video') {
      return { type: 'video', icon: '▶️', color: '#9C27B0', bgColor: '#F3E5F5' };
    }
    if (category === 'audio') {
      return { type: 'audio', icon: '🔊', color: '#E91E63', bgColor: '#FCE4EC' };
    }
    if (category === 'text') {
      return { type: 'text', icon: '📝', color: '#2196F3', bgColor: '#E3F2FD' };
    }
    if (mimeType.includes('pdf')) {
      return { type: 'document', icon: '📄', color: '#F44336', bgColor: '#FFEBEE' };
    }
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) {
      return { type: 'archive', icon: '📦', color: '#FF9800', bgColor: '#FFF3E0' };
    }
    if (mimeType.includes('msword') || mimeType.includes('wordprocessing') || 
        mimeType.includes('excel') || mimeType.includes('spreadsheet') ||
        mimeType.includes('powerpoint') || mimeType.includes('presentation')) {
      return { type: 'document', icon: '📊', color: '#3F51B5', bgColor: '#E8EAF6' };
    }
  }

  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'].includes(ext || '')) {
      return { type: 'image', icon: '📷', color: '#4CAF50', bgColor: '#E8F5E9' };
    }
    if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'].includes(ext || '')) {
      return { type: 'video', icon: '▶️', color: '#9C27B0', bgColor: '#F3E5F5' };
    }
    if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'].includes(ext || '')) {
      return { type: 'audio', icon: '🔊', color: '#E91E63', bgColor: '#FCE4EC' };
    }
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'].includes(ext || '')) {
      return { type: 'document', icon: '📄', color: '#F44336', bgColor: '#FFEBEE' };
    }
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext || '')) {
      return { type: 'archive', icon: '📦', color: '#FF9800', bgColor: '#FFF3E0' };
    }
    if (['js', 'ts', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'php', 'rb', 'swift', 'kt'].includes(ext || '')) {
      return { type: 'code', icon: '💻', color: '#00BCD4', bgColor: '#E0F7FA' };
    }
    if (['txt', 'md', 'json', 'xml', 'yaml', 'yml', 'csv', 'log'].includes(ext || '')) {
      return { type: 'text', icon: '📝', color: '#2196F3', bgColor: '#E3F2FD' };
    }
  }
  return { type: 'other', icon: '📁', color: '#9E9E9E', bgColor: '#F5F5F5' };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
