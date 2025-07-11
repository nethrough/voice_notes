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
  const [fullTranscript, setFullTranscript] = useState(''); // Store complete transcript
  
  const recognitionRef = useRef(null);
  const dropdownRef = useRef(null);
  const shouldContinueListeningRef = useRef(false); // Flag to control continuous listening
  const restartTimeoutRef = useRef(null);
  const isRestartingRef = useRef(false); // Prevent multiple restarts

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
      shouldContinueListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore errors on cleanup
        }
      }
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
    };
  }, [selectedLanguage, onTranscript]);

  const initializeSpeechRecognition = () => {
    const SpeechRecognition = getSpeechRecognition();
    recognitionRef.current = new SpeechRecognition();
    
    // Configuration for speech recognition
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = selectedLanguage;
    recognitionRef.current.maxAlternatives = 1;

    recognitionRef.current.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';
      let bestConfidence = 0;

      // Process all results
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

      // Update the display transcript (interim + any new final)
      const displayTranscript = fullTranscript + finalTranscript + interimTranscript;
      setTranscript(displayTranscript);
      setConfidence(bestConfidence || (interimTranscript ? 0.8 : 0));
      
      // If we have final transcript, add it to our full transcript
      if (finalTranscript) {
        const newFullTranscript = fullTranscript + finalTranscript;
        setFullTranscript(newFullTranscript);
        // Don't call onTranscript yet - wait until user stops recording
        logEvent('voice_transcript_partial', { 
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
      
      // Handle different error types
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setTranscript('Microphone access denied. Please allow microphone access and try again.');
        shouldContinueListeningRef.current = false;
        setIsListening(false);
      } else if (event.error === 'network') {
        setTranscript('Network error. Trying to reconnect...');
        // Try to restart on network errors
        if (shouldContinueListeningRef.current) {
          restartRecognition();
        }
      } else {
        // For other errors, just try to continue
        console.log('Non-critical error, continuing...', event.error);
        if (shouldContinueListeningRef.current && !isRestartingRef.current) {
          restartRecognition();
        }
      }
    };

    recognitionRef.current.onend = () => {
      console.log('Recognition ended. Should continue:', shouldContinueListeningRef.current);
      
      // If we should continue listening and we're not already restarting, restart immediately
      if (shouldContinueListeningRef.current && !isRestartingRef.current) {
        console.log('Auto-restarting recognition to maintain continuous listening...');
        restartRecognition();
      } else if (!shouldContinueListeningRef.current) {
        // User stopped, finalize the session
        finalizeRecording();
      }
    };

    recognitionRef.current.onstart = () => {
      console.log('Speech recognition started');
      isRestartingRef.current = false;
      if (!transcript || transcript === 'Starting...') {
        setTranscript('Listening... speak now');
      }
    };
  };

  const restartRecognition = () => {
    if (isRestartingRef.current) {
      console.log('Already restarting, skipping...');
      return;
    }
    
    isRestartingRef.current = true;
    
    // Clear any existing timeout
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }
    
    restartTimeoutRef.current = setTimeout(() => {
      if (shouldContinueListeningRef.current && recognitionRef.current) {
        try {
          console.log('Restarting recognition...');
          recognitionRef.current.start();
        } catch (error) {
          console.error('Error restarting recognition:', error);
          isRestartingRef.current = false;
          
          // If start fails, try again with a longer delay
          if (shouldContinueListeningRef.current) {
            setTimeout(() => {
              if (shouldContinueListeningRef.current) {
                restartRecognition();
              }
            }, 1000);
          }
        }
      } else {
        isRestartingRef.current = false;
      }
    }, 100); // Short delay to prevent rapid restarts
  };

  const startListening = () => {
    if (!recognitionRef.current || isListening) return;
    
    console.log('Starting continuous listening...');
    shouldContinueListeningRef.current = true;
    setIsListening(true);
    setTranscript('Starting...');
    setFullTranscript('');
    setConfidence(0);
    
    try {
      recognitionRef.current.start();
      logEvent('voice_recording_start', { language: selectedLanguage });
    } catch (error) {
      console.error('Error starting recognition:', error);
      setTranscript('Error starting voice recognition. Please try again.');
      setIsListening(false);
      shouldContinueListeningRef.current = false;
    }
  };

  const stopListening = () => {
    console.log('Stopping continuous listening...');
    shouldContinueListeningRef.current = false; // Stop the continuous loop
    
    // Clear any pending restart
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    
    // Stop the current recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
    }
    
    // Finalize immediately if we have content
    finalizeRecording();
  };

  const finalizeRecording = () => {
    setIsListening(false);
    isRestartingRef.current = false;
    
    // Send the complete transcript to the parent
    const completeTranscript = fullTranscript + (transcript.replace(fullTranscript, '').replace('Listening... speak now', '').replace('Starting...', '').trim());
    
    if (completeTranscript.trim()) {
      onTranscript(completeTranscript.trim());
      logEvent('voice_recording_complete', { 
        length: completeTranscript.length, 
        language: selectedLanguage 
      });
    }
    
    setFullTranscript('');
    setTranscript('');
    setConfidence(0);
    
    logEvent('voice_recording_stop', { language: selectedLanguage });
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
              ? '🔄 සත්‍ය අඛණ්ඩ පටිගැනීම: ඔබ නතර කරන තුරු ඕනෑ තරම් නිශ්ශබ්ද කාලයක් සමඟ කතා කරන්න.'
              : '🔄 True continuous recording: Speak with unlimited pauses until you stop.'
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
              : (selectedLanguage.startsWith('si') ? 'අඛණ්ඩ පටිගැනීම ආරම්භ කරන්න' : 'Start Continuous Recording')
            }
          </span>
        </button>
        
        {isListening && (
          <div className="listening-indicator">
            <div className="pulse-dot"></div>
            <span>
              {selectedLanguage.startsWith('si') 
                ? '🔄 අඛණ්ඩව සවන් දෙමින්... (නිශ්ශබ්දතාවයෙන් නතර නොවේ)' 
                : '🔄 Continuously listening... (won\'t stop on silence)'
              }
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