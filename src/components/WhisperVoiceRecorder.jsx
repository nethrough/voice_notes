// File: /src/components/WhisperVoiceRecorder.jsx
import React, { useState, useRef, useEffect } from 'react';
import { transcribeAudio, isWhisperSupported } from '../utils/whisperAPI';
import { logEvent, storage } from '../utils/helpers';

const LANGUAGE_STORAGE_KEY = 'voice-notes-language';

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English (US)', flag: '🇺🇸', whisperCode: 'en' },
  { code: 'en-gb', name: 'English (UK)', flag: '🇬🇧', whisperCode: 'en' },
  { code: 'en-au', name: 'English (Australia)', flag: '🇦🇺', whisperCode: 'en' },
  { code: 'en-ca', name: 'English (Canada)', flag: '🇨🇦', whisperCode: 'en' },
];

const WhisperVoiceRecorder = ({ onTranscript, disabled = false }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const dropdownRef = useRef(null);
  const timerRef = useRef(null);

  // Load saved language preference
  useEffect(() => {
    const savedLanguage = storage.get(LANGUAGE_STORAGE_KEY, 'en');
    setSelectedLanguage(savedLanguage);
  }, []);

  // Save language preference when changed
  useEffect(() => {
    storage.set(LANGUAGE_STORAGE_KEY, selectedLanguage);
  }, [selectedLanguage]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowLanguageDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check support on mount
  useEffect(() => {
    checkSupport();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const checkSupport = async () => {
    const supported = await isWhisperSupported();
    setIsSupported(supported);
    
    if (!supported) {
      console.error('MediaRecorder or Whisper API not supported');
    }
  };

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const startRecording = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000 // Optimal for Whisper
        }
      });
      
      streamRef.current = stream;
      audioChunksRef.current = [];
      
      // Create MediaRecorder with optimal settings for Whisper
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      // Handle data chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      // Handle recording stop
      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length > 0) {
          await processRecording();
        }
      };
      
      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      setTranscript('🎤 Recording... Speak in English');
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      logEvent('whisper_recording_start', { 
        language: selectedLanguage,
        userAgent: navigator.userAgent 
      });
      
    } catch (error) {
      console.error('Error starting recording:', error);
      setTranscript('❌ Could not access microphone. Please allow microphone access.');
      
      if (error.name === 'NotAllowedError') {
        setTranscript('❌ Microphone access denied. Please allow microphone access and try again.');
      } else if (error.name === 'NotFoundError') {
        setTranscript('❌ No microphone found. Please connect a microphone and try again.');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    setIsRecording(false);
    setIsProcessing(true);
    setTranscript('🔄 Processing audio...');
    
    logEvent('whisper_recording_stop', { 
      language: selectedLanguage,
      duration: recordingTime 
    });
  };

  const processRecording = async () => {
    try {
      // Create audio blob
      const audioBlob = new Blob(audioChunksRef.current, { 
        type: mediaRecorderRef.current.mimeType 
      });
      
      console.log('Processing audio blob:', {
        size: audioBlob.size,
        type: audioBlob.type
      });
      
      setTranscript('🤖 Transcribing with Whisper AI...');
      
      // Transcribe with Whisper (always use 'en' since we only support English)
      const result = await transcribeAudio(audioBlob, 'en');
      
      if (result.success && result.text.trim()) {
        const finalText = result.text.trim();
        setTranscript(`✅ Transcription complete!`);
        
        // Send to parent component
        onTranscript(finalText);
        
        logEvent('whisper_transcription_success', { 
          language: selectedLanguage,
          textLength: finalText.length,
          duration: recordingTime
        });
        
        // Clear transcript after short delay
        setTimeout(() => {
          setTranscript('');
        }, 2000);
        
      } else {
        setTranscript(`❌ ${result.error || 'Could not transcribe audio. Please try speaking in English and try again.'}`);
        console.error('Transcription failed:', result.error);
        
        logEvent('whisper_transcription_error', { 
          language: selectedLanguage,
          error: result.error 
        });
      }
      
    } catch (error) {
      console.error('Error processing recording:', error);
      setTranscript('❌ Error processing audio. Please try again.');
      
      logEvent('whisper_processing_error', { 
        language: selectedLanguage,
        error: error.message 
      });
    } finally {
      setIsProcessing(false);
      setRecordingTime(0);
      
      // Cleanup
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleLanguageSelect = (languageCode) => {
    if (isRecording) {
      stopRecording();
    }
    setSelectedLanguage(languageCode);
    setShowLanguageDropdown(false);
    logEvent('language_changed', { language: languageCode });
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentLanguage = SUPPORTED_LANGUAGES.find(lang => lang.code === selectedLanguage);

  if (!isSupported) {
    return (
      <div className="voice-recorder unsupported">
        <div className="unsupported-message">
          <span className="icon">⚠️</span>
          <p>Voice recording is not supported in your browser.</p>
          <small>Please try using Chrome, Edge, or Safari for the best experience.</small>
        </div>
      </div>
    );
  }

  return (
    <div className="voice-recorder">
      {/* Language Selection */}
      <div className="language-section">
        <div className="language-selector" ref={dropdownRef}>
          <button 
            className="language-button"
            onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
            disabled={isRecording || isProcessing}
          >
            <span className="language-flag">{currentLanguage.flag}</span>
            <span className="language-name">{currentLanguage.name}</span>
            <span className="dropdown-arrow">▼</span>
          </button>
          
          {showLanguageDropdown && (
            <div className="language-dropdown">
              {SUPPORTED_LANGUAGES.map(language => (
                <button
                  key={language.code}
                  className={`language-option ${selectedLanguage === language.code ? 'active' : ''}`}
                  onClick={() => handleLanguageSelect(language.code)}
                >
                  <span className="language-flag">{language.flag}</span>
                  <span className="language-name">{language.name}</span>
                  {selectedLanguage === language.code && <span className="check-mark">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* English-focused info */}
        <div className="whisper-info">
          <span className="info-icon">🤖</span>
          <small>
            Powered by OpenAI Whisper
          </small>
        </div>
      </div>

      {/* Recording Controls */}
      <div className="recorder-container">
        <button
          className={`record-button ${isRecording ? 'recording' : ''} ${isProcessing ? 'processing' : ''}`}
          onClick={toggleRecording}
          disabled={disabled || isProcessing}
        >
          <span className="record-icon">
            {isProcessing ? '🔄' : isRecording ? '⏹️' : '🎙️'}
          </span>
          <span className="record-text">
            {isProcessing 
              ? 'Processing...'
              : isRecording 
                ? `Stop (${formatTime(recordingTime)})`
                : 'Start Recording'
            }
          </span>
        </button>
        
        {isRecording && (
          <div className="recording-indicator">
            <div className="pulse-dot"></div>
            <span>🎤 Recording - Speak in English 🚀</span>
          </div>
        )}
        
        {isProcessing && (
          <div className="processing-indicator">
            <div className="spinner"></div>
            <span>🤖 Whisper AI is transcribing your English speech...</span>
          </div>
        )}
      </div>
      
      {/* Live Status */}
      {transcript && (
        <div className="transcript-preview">
          <p>{transcript}</p>
        </div>
      )}
    </div>
  );
};

export default WhisperVoiceRecorder;