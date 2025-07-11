// File: /src/utils/helpers.js

// Generate unique ID for notes
export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Format date for display
export const formatDate = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInMs = now - date;
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  if (diffInDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffInDays === 1) {
    return 'Yesterday';
  } else if (diffInDays < 7) {
    return `${diffInDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
};

// Truncate text for previews
export const truncateText = (text, maxLength = 150) => {
  if (text.length <= maxLength) return text;
  return text.substr(0, maxLength).trim() + '...';
};

// Local storage helpers
export const storage = {
  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return defaultValue;
    }
  },
  
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Error writing to localStorage:', error);
      return false;
    }
  },
  
  remove: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Error removing from localStorage:', error);
      return false;
    }
  }
};

// Export functions
export const exportToFile = (content, filename, type = 'text/plain') => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Convert notes to different formats
export const formatNotesForExport = (notes, format = 'txt') => {
  if (format === 'md') {
    return notes.map(note => {
      const date = new Date(note.createdAt).toLocaleDateString();
      const source = note.source === 'whisper' ? ' (🤖 Whisper AI)' : '';
      return `# ${note.title || 'Untitled Note'}${source}\n\n*Created: ${date}*\n\n${note.content}\n\n---\n`;
    }).join('\n');
  }
  
  // Default to plain text
  return notes.map(note => {
    const date = new Date(note.createdAt).toLocaleDateString();
    const source = note.source === 'whisper' ? ' (Whisper AI)' : '';
    return `${note.title || 'Untitled Note'}${source}\nCreated: ${date}\n\n${note.content}\n\n${'='.repeat(50)}\n`;
  }).join('\n');
};

// Debounce function for search/save operations
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Detect if we're in development mode
const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

// Log events (enhanced for Whisper)
export const logEvent = async (event, data = {}) => {
  // In development, just log to console
  if (isDevelopment) {
    console.log('📊 Analytics Event:', {
      event,
      data: { ...data, apiType: 'whisper' },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // In production, you could send to your analytics service
  try {
    // Example: send to your own analytics endpoint
    // await fetch('/api/analytics', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ event, data, timestamp: new Date().toISOString() })
    // });
  } catch (error) {
    if (isDevelopment) {
      console.warn('Analytics logging failed:', error.message);
    }
  }
};