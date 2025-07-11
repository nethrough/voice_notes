// File: /src/components/VoiceRecorder.jsx
import React, { useState, useRef, useEffect } from 'react';
import { isWebSpeechSupported, getSpeechRecognition, logEvent, storage } from '../utils/helpers';

const LANGUAGE_STORAGE_KEY = 'voice-notes-language';

const SUPPORTED_LANGUAGES = [
  { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧' },
  { code: 'si-LK', name: 'සිංහල (Sri Lanka)', flag: '🇱🇰' },
];

// Simple mobile detection
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

const VoiceRecorder = ({ onTranscript, disabled = false }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const [confidence, setConfidence] = useState(0);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  
  const recognitionRef = useRef(null);
  const dropdownRef = useRef(null);
  const finalTranscriptRef = useRef(''); // Store the final result

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
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [selectedLanguage]);

  const initializeSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore
      }
    }

    const SpeechRecognition = getSpeechRecognition();
    recognitionRef.current = new SpeechRecognition();
    
    // SIMPLE settings - let the browser handle it naturally
    if (isMobile) {
      // Mobile: Single session, no auto-restart
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
    } else {
      // Desktop: More flexible but still simple
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
    }
    
    recognitionRef.current.lang = selectedLanguage;
    recognitionRef.current.maxAlternatives = 1;

    recognitionRef.current.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';
      let bestConfidence = 0;

      // Process results from the BEGINNING to avoid duplication
      for (let i = 0; i < event.results.length; i++) {
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

      // Simple display: final + interim (no accumulation to prevent duplication)
      const displayText = finalTranscript + interimTranscript;
      setTranscript(displayText);
      setConfidence(bestConfidence || (interimTranscript ? 0.8 : 0));
      
      // Store final transcript for later use
      if (finalTranscript) {
        finalTranscriptRef.current = finalTranscript;
        console.log('Final transcript captured:', finalTranscript);
      }
    };

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      
      // Simple error handling
      if (event.error === 'not-allowed') {
        setTranscript('Microphone access denied. Please allow microphone access.');
      } else if (event.error === 'network') {
        setTranscript('Network error. Please check your connection.');
      } else if (event.error === 'no-speech') {
        setTranscript('No speech detected. Please try speaking again.');
      } else {
        setTranscript('Recognition error. Please try again.');
      }
      
      // Always stop on error - no restart attempts
      setIsListening(false);
      
      logEvent('voice_recognition_error', { 
        error: event.error,
        language: selectedLanguage,
        isMobile
      });
    };

    recognitionRef.current.onend = () => {
      console.log('Recognition ended naturally');
      setIsListening(false);
      
      // Send the transcript if we have one
      if (finalTranscriptRef.current.trim()) {
        const finalText = finalTranscriptRef.current.trim();
        console.log('Sending final transcript:', finalText);
        onTranscript(finalText);
        
        logEvent('voice_transcript_complete', { 
          length: finalText.length, 
          language: selectedLanguage,
          isMobile
        });
      }
      
      // Reset for next session
      finalTranscriptRef.current = '';
      setTranscript('');
      setConfidence(0);
    };

    recognitionRef.current.onstart = () => {
      console.log('Recognition started');
      setTranscript('Listening...');
      finalTranscriptRef.current = '';
    };
  };

  const startListening = () => {
    if (!recognitionRef.current || isListening) return;
    
    console.log('Starting simple recording...');
    setIsListening(true);
    setTranscript('Starting...');
    setConfidence(0);
    finalTranscriptRef.current = '';
    
    try {
      recognitionRef.current.start();
      logEvent('voice_recording_start', { 
        language: selectedLanguage,
        isMobile
      });
    } catch (error) {
      console.error('Error starting recognition:', error);
      setTranscript('Could not start recording. Please try again.');
      setIsListening(false);
    }
  };

  const stopListening = () => {
    console.log('Manually stopping recording...');
    
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop(); // This will trigger onend
      } catch (error) {
        console.error('Error stopping recognition:', error);
        // Force cleanup if stop fails
        setIsListening(false);
        if (finalTranscriptRef.current.trim()) {
          onTranscript(finalTranscriptRef.current.trim());
        }
        finalTranscriptRef.current = '';
        setTranscript('');
      }
    }
    
    logEvent('voice_recording_stop', { 
      language: selectedLanguage,
      isMobile
    });
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
          <small>Try using Chrome, Edge, or Safari for the best experience.</small>
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
        
        {/* Simple, honest tips */}
        <div className="accuracy-tips">
          <span className="tips-icon">💡</span>
          <small>
            {isMobile ? (
              selectedLanguage.startsWith('si') 
                ? '📱 ජංගම: කෙටි කාලයක් සඳහා කතා කරන්න. නැවත ආරම්භ කිරීමට නැවත ක්ලික් කරන්න.'
                : '📱 Mobile: Speak for a short time. Click again to record more.'
            ) : (
              selectedLanguage.startsWith('si') 
                ? '🖥️ ඩෙස්ක්ටොප්: දිගට්ම කතා කරන්න හෝ ඔබ නතර කරන තුරු.'
                : '🖥️ Desktop: Speak continuously or until you stop.'
            )}
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
              ? (selectedLanguage.startsWith('si') ? 'නවත්වන්න' : 'Stop')
              : (selectedLanguage.startsWith('si') ? 'පටිගැනීම' : 'Record')
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
      {transcript && transcript !== 'Starting...' && (
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