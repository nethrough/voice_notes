// File: /src/components/VoiceRecorder.jsx
import React, { useState, useRef, useEffect } from 'react';
import { isWebSpeechSupported, getSpeechRecognition, logEvent, storage } from '../utils/helpers';

const LANGUAGE_STORAGE_KEY = 'voice-notes-language';

const SUPPORTED_LANGUAGES = [
  { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧' },
  { code: 'si-LK', name: 'සිංහල (Sri Lanka)', flag: '🇱🇰' },
];

const VoiceRecorder = ({ onTranscript, disabled = false }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const [confidence, setConfidence] = useState(0);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const recognitionRef = useRef(null);
  const dropdownRef = useRef(null);

  // Load saved language preference
  useEffect(() => {
    const savedLanguage = storage.get(LANGUAGE_STORAGE_KEY, 'en-US');
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

  useEffect(() => {
    setIsSupported(isWebSpeechSupported());
    
    if (isWebSpeechSupported()) {
      initializeSpeechRecognition();
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [selectedLanguage, onTranscript]);

  const initializeSpeechRecognition = () => {
    const SpeechRecognition = getSpeechRecognition();
    recognitionRef.current = new SpeechRecognition();
    
    // Enhanced configuration for better accuracy
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = selectedLanguage;
    recognitionRef.current.maxAlternatives = 3; // Get multiple alternatives
    
    // Additional settings for better accuracy
    if (selectedLanguage.startsWith('si')) {
      // Sinhala-specific optimizations
      recognitionRef.current.grammars = null; // Use default grammar
    }

    recognitionRef.current.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      let bestConfidence = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptPart = result[0].transcript;
        const confidence = result[0].confidence || 0;
        
        if (result.isFinal) {
          finalTranscript += transcriptPart;
          bestConfidence = Math.max(bestConfidence, confidence);
        } else {
          interimTranscript += transcriptPart;
        }
      }

      const fullTranscript = finalTranscript || interimTranscript;
      setTranscript(fullTranscript);
      setConfidence(bestConfidence);
      
      if (finalTranscript) {
        onTranscript(finalTranscript);
        logEvent('voice_transcript_complete', { 
          length: finalTranscript.length, 
          language: selectedLanguage,
          confidence: bestConfidence 
        });
      }
    };

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      logEvent('voice_recognition_error', { 
        error: event.error,
        language: selectedLanguage 
      });
      
      // Provide user-friendly error messages
      if (event.error === 'no-speech') {
        setTranscript('No speech detected. Please try speaking closer to the microphone.');
      } else if (event.error === 'network') {
        setTranscript('Network error. Please check your internet connection.');
      }
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
      setConfidence(0);
    };

    recognitionRef.current.onstart = () => {
      setTranscript('');
      setConfidence(0);
    };
  };

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setTranscript('');
      setConfidence(0);
      recognitionRef.current.start();
      setIsListening(true);
      logEvent('voice_recording_start', { language: selectedLanguage });
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      logEvent('voice_recording_stop', { language: selectedLanguage });
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleLanguageSelect = (languageCode) => {
    if (isListening) {
      stopListening();
    }
    setSelectedLanguage(languageCode);
    setShowLanguageDropdown(false);
    logEvent('language_changed', { language: languageCode });
  };

  const currentLanguage = SUPPORTED_LANGUAGES.find(lang => lang.code === selectedLanguage);

  if (!isSupported) {
    return (
      <div className="voice-recorder unsupported">
        <div className="unsupported-message">
          <span className="icon">⚠️</span>
          <p>Voice recognition is not supported in your browser.</p>
          <small>Try using Chrome, Edge, or Safari for the best experience with Sinhala and English.</small>
        </div>
        
        <style jsx>{`
          .voice-recorder.unsupported {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-lg);
            padding: var(--spacing-lg);
            text-align: center;
          }
          
          .unsupported-message {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: var(--spacing-sm);
          }
          
          .icon {
            font-size: var(--font-size-2xl);
          }
          
          .unsupported-message p {
            color: var(--text-secondary);
            margin: 0;
          }
          
          .unsupported-message small {
            color: var(--text-muted);
            font-size: var(--font-size-xs);
          }
        `}</style>
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
            disabled={isListening}
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
        
        {/* Accuracy Tips */}
        <div className="accuracy-tips">
          <span className="tips-icon">💡</span>
          <small>
            {selectedLanguage.startsWith('si') 
              ? 'සිංහල: පැහැදිලිව හා සෙමින් කතා කරන්න. නිශ්ශබ්ද ස්ථානයක සිටින්න.'
              : 'Speak clearly and at normal pace. Use in a quiet environment for best results.'
            }
          </small>
        </div>
      </div>

      {/* Recording Controls */}
      <div className="recorder-container">
        <button
          className={`record-button ${isListening ? 'recording' : ''}`}
          onClick={toggleListening}
          disabled={disabled}
          title={isListening ? 'Stop recording' : 'Start recording'}
        >
          <span className="record-icon">
            {isListening ? '⏹️' : '🎙️'}
          </span>
          <span className="record-text">
            {isListening 
              ? (selectedLanguage.startsWith('si') ? 'පටිගත කිරීම නවත්වන්න' : 'Stop Recording')
              : (selectedLanguage.startsWith('si') ? 'පටිගත කිරීම ආරම්භ කරන්න' : 'Start Recording')
            }
          </span>
        </button>
        
        {isListening && (
          <div className="listening-indicator">
            <div className="pulse-dot"></div>
            <span>
              {selectedLanguage.startsWith('si') ? 'සවන් දෙමින්...' : 'Listening...'}
            </span>
            {confidence > 0 && (
              <div className="confidence-meter">
                <div 
                  className="confidence-bar" 
                  style={{ width: `${confidence * 100}%` }}
                ></div>
                <span className="confidence-text">{Math.round(confidence * 100)}%</span>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Live Transcript */}
      {transcript && (
        <div className="transcript-preview">
          <label>
            {selectedLanguage.startsWith('si') ? 'සජීවී පිටපත:' : 'Live Transcript:'}
          </label>
          <p className={selectedLanguage.startsWith('si') ? 'sinhala-text' : ''}>{transcript}</p>
          {confidence > 0 && (
            <div className="confidence-info">
              <span className="confidence-label">
                {selectedLanguage.startsWith('si') ? 'විශ්වාසනීයත්වය:' : 'Confidence:'} {Math.round(confidence * 100)}%
              </span>
            </div>
          )}
        </div>
      )}
      
      <style jsx>{`
        .voice-recorder {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: var(--spacing-lg);
          margin-bottom: var(--spacing-lg);
        }
        
        .language-section {
          margin-bottom: var(--spacing-lg);
          padding-bottom: var(--spacing-md);
          border-bottom: 1px solid var(--border-color);
        }
        
        .language-selector {
          position: relative;
          display: inline-block;
          margin-bottom: var(--spacing-sm);
        }
        
        .language-button {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-sm) var(--spacing-md);
          background: var(--secondary-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          cursor: pointer;
          transition: all var(--transition-fast);
          font-size: var(--font-size-sm);
        }
        
        .language-button:hover:not(:disabled) {
          background: var(--card-hover-bg);
          border-color: var(--accent-color);
        }
        
        .language-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .language-flag {
          font-size: var(--font-size-lg);
        }
        
        .dropdown-arrow {
          font-size: var(--font-size-xs);
          color: var(--text-muted);
        }
        
        .language-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          z-index: 1000;
          box-shadow: var(--shadow-lg);
          margin-top: var(--spacing-xs);
          animation: slideUp 0.2s ease-out;
        }
        
        .language-option {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          width: 100%;
          padding: var(--spacing-sm) var(--spacing-md);
          background: transparent;
          border: none;
          color: var(--text-primary);
          cursor: pointer;
          transition: background var(--transition-fast);
          font-size: var(--font-size-sm);
          text-align: left;
        }
        
        .language-option:hover {
          background: var(--card-hover-bg);
        }
        
        .language-option.active {
          background: var(--accent-color);
          color: white;
        }
        
        .check-mark {
          margin-left: auto;
          color: currentColor;
        }
        
        .accuracy-tips {
          display: flex;
          align-items: flex-start;
          gap: var(--spacing-xs);
          background: var(--secondary-bg);
          padding: var(--spacing-sm);
          border-radius: var(--radius-sm);
          border-left: 3px solid var(--accent-color);
        }
        
        .tips-icon {
          font-size: var(--font-size-sm);
          margin-top: 1px;
        }
        
        .accuracy-tips small {
          color: var(--text-muted);
          font-size: var(--font-size-xs);
          line-height: 1.4;
        }
        
        .recorder-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--spacing-md);
        }
        
        .record-button {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-md) var(--spacing-xl);
          background: var(--accent-color);
          color: white;
          border: none;
          border-radius: var(--radius-xl);
          font-size: var(--font-size-lg);
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-normal);
          position: relative;
          overflow: hidden;
          min-width: 200px;
          justify-content: center;
        }
        
        .record-button:hover:not(:disabled) {
          background: var(--accent-hover);
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
        }
        
        .record-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .record-button.recording {
          background: var(--danger-color);
          animation: pulse 1.5s infinite;
        }
        
        .record-button.recording:hover:not(:disabled) {
          background: var(--danger-hover);
        }
        
        .record-icon {
          font-size: var(--font-size-xl);
        }
        
        .listening-indicator {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--spacing-sm);
          color: var(--text-secondary);
          font-size: var(--font-size-sm);
        }
        
        .pulse-dot {
          width: 8px;
          height: 8px;
          background: var(--success-color);
          border-radius: 50%;
          animation: pulse 1s infinite;
        }
        
        .confidence-meter {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          width: 200px;
        }
        
        .confidence-bar {
          height: 4px;
          background: var(--success-color);
          border-radius: 2px;
          transition: width var(--transition-fast);
          flex-grow: 1;
        }
        
        .confidence-text {
          font-size: var(--font-size-xs);
          color: var(--text-muted);
          min-width: 30px;
        }
        
        .transcript-preview {
          margin-top: var(--spacing-md);
          padding-top: var(--spacing-md);
          border-top: 1px solid var(--border-color);
        }
        
        .transcript-preview label {
          display: block;
          font-size: var(--font-size-sm);
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: var(--spacing-sm);
        }
        
        .transcript-preview p {
          color: var(--text-primary);
          font-style: italic;
          line-height: 1.6;
          margin: 0;
          padding: var(--spacing-sm);
          background: var(--secondary-bg);
          border-radius: var(--radius-sm);
          border-left: 3px solid var(--success-color);
        }
        
        .sinhala-text {
          font-family: 'Noto Sans Sinhala', 'Iskoola Pota', sans-serif;
          font-size: var(--font-size-lg);
          line-height: 1.8;
        }
        
        .confidence-info {
          margin-top: var(--spacing-sm);
        }
        
        .confidence-label {
          font-size: var(--font-size-xs);
          color: var(--text-muted);
          background: var(--card-bg);
          padding: var(--spacing-xs) var(--spacing-sm);
          border-radius: var(--radius-sm);
        }
        
        @media (max-width: 768px) {
          .record-button {
            padding: var(--spacing-sm) var(--spacing-lg);
            font-size: var(--font-size-base);
            min-width: 150px;
          }
          
          .record-text {
            font-size: var(--font-size-sm);
          }
          
          .language-dropdown {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 90vw;
            max-width: 300px;
          }
          
          .confidence-meter {
            width: 150px;
          }
        }
        
        @media (max-width: 480px) {
          .record-text {
            display: none;
          }
          
          .accuracy-tips {
            flex-direction: column;
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
};

export default VoiceRecorder;