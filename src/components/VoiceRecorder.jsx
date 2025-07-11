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
    
    // Note: We don't set grammars property as it can cause errors
    // The browser will use default grammar which works fine for all languages

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
    </div>
  );
};

export default VoiceRecorder;