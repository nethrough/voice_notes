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
  const isManualStopRef = useRef(false); // Track if user manually stopped
  const restartTimeoutRef = useRef(null); // For handling restart delays

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
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
    };
  }, [selectedLanguage, onTranscript]);

  const initializeSpeechRecognition = () => {
    const SpeechRecognition = getSpeechRecognition();
    recognitionRef.current = new SpeechRecognition();
    
    // Enhanced configuration for continuous listening
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = selectedLanguage;
    recognitionRef.current.maxAlternatives = 3;

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
      
      logEvent('voice_recognition_error', { 
        error: event.error,
        language: selectedLanguage 
      });
      
      // Handle different types of errors
      if (event.error === 'no-speech') {
        // Don't stop for no-speech errors, just continue listening
        setTranscript('Waiting for speech...');
      } else if (event.error === 'network') {
        setTranscript('Network error. Please check your internet connection.');
        setIsListening(false);
        isManualStopRef.current = true; // Stop on network errors
      } else if (event.error === 'not-allowed') {
        setTranscript('Microphone access denied. Please allow microphone access.');
        setIsListening(false);
        isManualStopRef.current = true; // Stop on permission errors
      } else {
        // For other errors, try to restart if we're still supposed to be listening
        console.log('Speech recognition error, but continuing...', event.error);
      }
    };

    recognitionRef.current.onend = () => {
      console.log('Speech recognition ended. Manual stop:', isManualStopRef.current);
      
      // Only truly stop if it was a manual stop
      if (isManualStopRef.current) {
        setIsListening(false);
        setConfidence(0);
        isManualStopRef.current = false; // Reset the flag
      } else {
        // Automatically restart if it wasn't a manual stop
        console.log('Auto-restarting speech recognition...');
        restartTimeoutRef.current = setTimeout(() => {
          if (recognitionRef.current && isListening) {
            try {
              recognitionRef.current.start();
            } catch (error) {
              console.error('Error restarting recognition:', error);
              setIsListening(false);
            }
          }
        }, 100); // Small delay to prevent rapid restart loops
      }
    };

    recognitionRef.current.onstart = () => {
      console.log('Speech recognition started');
      setTranscript('');
      setConfidence(0);
    };
  };

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setTranscript('');
      setConfidence(0);
      isManualStopRef.current = false; // Reset manual stop flag
      
      try {
        recognitionRef.current.start();
        setIsListening(true);
        logEvent('voice_recording_start', { language: selectedLanguage });
      } catch (error) {
        console.error('Error starting recognition:', error);
        setTranscript('Error starting voice recognition. Please try again.');
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      isManualStopRef.current = true; // Mark as manual stop
      recognitionRef.current.stop();
      
      // Clear any pending restart
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      
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
              ? 'සිංහල: දැන් ඔබට ඕනෑ තරම් නැවතීම් සමඟ කතා කළ හැක. ඔබ නැවැත්වීම ඔබන තුරු පටිගත වේ.'
              : 'You can now speak with pauses. Recording will continue until you click stop.'
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
              {selectedLanguage.startsWith('si') ? 'සවන් දෙමින්... (ඔබ නතර කරන තුරු)' : 'Listening... (until you stop)'}
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