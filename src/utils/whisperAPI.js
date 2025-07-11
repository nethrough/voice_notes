// File: /src/utils/whisperAPI.js

const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models/openai/whisper-large-v3';
const API_TOKEN = import.meta.env.VITE_HUGGINGFACE_API_TOKEN;

/**
 * Check if Whisper API is supported
 */
export const isWhisperSupported = async () => {
  // Check MediaRecorder support
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.error('MediaDevices not supported');
    return false;
  }
  
  if (!window.MediaRecorder) {
    console.error('MediaRecorder not supported');
    return false;
  }
  
  // Check API token
  if (!API_TOKEN) {
    console.error('Hugging Face API token not found. Please add VITE_HUGGINGFACE_API_TOKEN to your .env.local file');
    return false;
  }
  
  return true;
};

/**
 * Convert WebM to WAV format (more compatible with Whisper)
 */
const convertToWav = async (audioBlob) => {
  return new Promise((resolve, reject) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Convert to WAV
        const numberOfChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const length = audioBuffer.length * numberOfChannels * 2;
        
        const buffer = new ArrayBuffer(44 + length);
        const view = new DataView(buffer);
        
        // WAV header
        const writeString = (offset, string) => {
          for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
          }
        };
        
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + length, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numberOfChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numberOfChannels * 2, true);
        view.setUint16(32, numberOfChannels * 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, length, true);
        
        // Convert audio data
        const channelData = audioBuffer.getChannelData(0);
        let offset = 44;
        for (let i = 0; i < channelData.length; i++) {
          const sample = Math.max(-1, Math.min(1, channelData[i]));
          view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
          offset += 2;
        }
        
        resolve(new Blob([buffer], { type: 'audio/wav' }));
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = reject;
    reader.readAsArrayBuffer(audioBlob);
  });
};

/**
 * Transcribe audio using Whisper API
 */
export const transcribeAudio = async (audioBlob, language = 'en') => {
  try {
    console.log('Starting Whisper transcription...', { 
      language, 
      audioSize: audioBlob.size,
      audioType: audioBlob.type 
    });
    
    // Check API token
    if (!API_TOKEN) {
      throw new Error('Hugging Face API token not configured');
    }
    
    // Convert to WAV format for better compatibility
    let processedAudio;
    try {
      processedAudio = await convertToWav(audioBlob);
      console.log('Audio converted to WAV:', processedAudio.size, 'bytes');
    } catch (conversionError) {
      console.warn('WAV conversion failed, using original:', conversionError);
      processedAudio = audioBlob;
    }
    
    // Prepare headers
    const headers = {
      'Authorization': `Bearer ${API_TOKEN}`,
    };
    
    // Add language parameter if supported (optional for Whisper)
    if (language && language !== 'auto') {
      headers['X-Use-Cache'] = 'false'; // Prevent caching issues with language changes
    }
    
    // Make API request with binary data
    const response = await fetch(HUGGINGFACE_API_URL, {
      method: 'POST',
      headers: headers,
      body: processedAudio // Send binary audio data directly
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Whisper API error:', response.status, errorText);
      
      if (response.status === 401) {
        throw new Error('Invalid API token. Please check your Hugging Face API token.');
      } else if (response.status === 503) {
        throw new Error('Whisper model is loading. Please try again in a few seconds.');
      } else if (response.status === 400) {
        throw new Error('Audio format not supported. Please try again with a different recording.');
      } else {
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }
    }
    
    const result = await response.json();
    console.log('Whisper API response:', result);
    
    // Handle different response formats
    let transcribedText = '';
    
    if (typeof result === 'string') {
      transcribedText = result;
    } else if (result.text) {
      transcribedText = result.text;
    } else if (Array.isArray(result) && result.length > 0) {
      // Handle array response
      if (typeof result[0] === 'string') {
        transcribedText = result[0];
      } else if (result[0].text) {
        transcribedText = result[0].text;
      } else {
        transcribedText = JSON.stringify(result[0]);
      }
    } else {
      console.error('Unexpected API response format:', result);
      throw new Error('Unexpected response format from Whisper API');
    }
    
    return {
      success: true,
      text: transcribedText.trim(),
      language: language
    };
    
  } catch (error) {
    console.error('Whisper transcription error:', error);
    return {
      success: false,
      error: error.message,
      text: ''
    };
  }
};

/**
 * Test Whisper API connection
 */
export const testWhisperAPI = async () => {
  try {
    const response = await fetch(HUGGINGFACE_API_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
      }
    });
    
    return response.ok || response.status === 405; // 405 is OK (method not allowed for GET)
  } catch (error) {
    console.error('Error testing Whisper API:', error);
    return false;
  }
};