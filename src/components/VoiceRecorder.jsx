// File: /src/components/VoiceRecorder.jsx
import React, { useState, useRef, useEffect } from 'react';
import { isWebSpeechSupported, getSpeechRecognition, logEvent, storage } from '../utils/helpers';

const LANGUAGE_STORAGE_KEY = 'voice-notes-language';

const SUPPORTED_LANGUAGES = [
  { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧' },
  { code: 'si-LK', name: 'සිංහල (Sri Lanka)', flag: '🇱🇰' },
];

// Detect if we're on mobile
const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform));
};

const VoiceRecorder = ({ onTranscript, disabled = false }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const [confidence, setConfidence] = useState(0);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [accumulatedTranscript, setAccumulatedTranscript] = useState('');
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  
  const recognitionRef = useRef(null);
  const dropdownRef = useRef(null);
  const shouldContinueRef = useRef(false);
  const restartTimeoutRef = useRef(null);
  const isRestartingRef = useRef(false);
  const lastRestartTimeRef = useRef(0);

  // Detect mobile on mount
  useEffect(() => {
    setIsMobileDevice(isMobile());
  }, []);

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
      cleanup();
    };
  }, [selectedLanguage, onTranscript]);

  const cleanup = () => {
    shouldContinueRef.current = false;
    isRestartingRef.current = false;
    
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  };

  const initializeSpeechRecognition = () => {
    const SpeechRecognition = getSpeechRecognition();
    recognitionRef.current = new SpeechRecognition();
    
    // Different settings for mobile vs desktop
    if (isMobileDevice) {
      // Conservative settings for mobile
      recognitionRef.current.continuous = false; // Less aggressive on mobile
      recognitionRef.current.interimResults = true;
    } else {
      // Aggressive settings for desktop
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
    }
    
    recognitionRef.current.lang = selectedLanguage;
    recognitionRef.current.maxAlternatives = 1;

    recognitionRef.current.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';
      let bestConfidence = 0;

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

      // Update display
      const currentDisplay = accumulatedTranscript + finalTranscript + interimTranscript;
      setTranscript(currentDisplay);
      setConfidence(bestConfidence || (interimTranscript ? 0.8 : 0));
      
      // Save final transcript
      if (finalTranscript) {
        const newAccumulated = accumulatedTranscript + finalTranscript;
        setAccumulatedTranscript(newAccumulated);
        logEvent('voice_transcript_partial', { 
          length: finalTranscript.length, 
          language: selectedLanguage,
          confidence: bestConfidence,
          isMobile: isMobileDevice
        });
      }
    };

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      
      logEvent('voice_recognition_error', { 
        error: event.error,
        language: selectedLanguage,
        isMobile: isMobileDevice
      });
      
      // Handle errors differently on mobile
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setTranscript('Microphone access denied. Please allow microphone access.');
        shouldContinueRef.current = false;
        setIsListening(false);
      } else if (event.error === 'network') {
        if (isMobileDevice) {
          setTranscript('Network issue. Please try again.');
          // Don't auto-restart on mobile network errors
          shouldContinueRef.current = false;
          setIsListening(false);
        } else {
          setTranscript('Network error. Reconnecting...');
          if (shouldContinueRef.current) {
            attemptRestart();
          }
        }
      } else {
        // Other errors - handle conservatively on mobile
        if (isMobileDevice) {
          console.log('Mobile: Error occurred, stopping to prevent issues:', event.error);
          shouldContinueRef.current = false;
          setIsListening(false);
        } else {
          console.log('Desktop: Non-critical error, attempting to continue:', event.error);
          if (shouldContinueRef.current && !isRestartingRef.current) {
            attemptRestart();
          }
        }
      }
    };

    recognitionRef.current.onend = () => {
      console.log('Recognition ended. Should continue:', shouldContinueRef.current, 'Is mobile:', isMobileDevice);
      
      if (shouldContinueRef.current && !isRestartingRef.current) {
        if (isMobileDevice) {
          // On mobile, be more conservative with restarts
          const now = Date.now();
          const timeSinceLastRestart = now - lastRestartTimeRef.current;
          
          if (timeSinceLastRestart > 1000) { // At least 1 second between restarts
            console.log('Mobile: Attempting careful restart...');
            attemptRestart();
          } else {
            console.log('Mobile: Too soon for restart, stopping to prevent loops');
            shouldContinueRef.current = false;
            setIsListening(false);
            finalizeRecording();
          }
        } else {
          // Desktop: More aggressive restart
          console.log('Desktop: Auto-restarting...');
          attemptRestart();
        }
      } else if (!shouldContinueRef.current) {
        finalizeRecording();
      }
    };

    recognitionRef.current.onstart = () => {
      console.log('Recognition started');
      isRestartingRef.current = false;
      lastRestartTimeRef.current = Date.now();
    };
  };

  const attemptRestart = () => {
    if (isRestartingRef.current || !shouldContinueRef.current) {
      return;
    }
    
    isRestartingRef.current = true;
    
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }
    
    // Different restart delays for mobile vs desktop
    const restartDelay = isMobileDevice ? 500 : 100;
    
    restartTimeoutRef.current = setTimeout(() => {
      if (shouldContinueRef.current && recognitionRef.current) {
        try {
          console.log(`${isMobileDevice ? 'Mobile' : 'Desktop'}: Restarting recognition...`);
          recognitionRef.current.start();
        } catch (error) {
          console.error('Error restarting recognition:', error);
          isRestartingRef.current = false;
          
          if (isMobileDevice) {
            // On mobile, give up after restart failure
            console.log('Mobile: Restart failed, stopping');
            shouldContinueRef.current = false;
            setIsListening(false);
            finalizeRecording();
          } else {
            // On desktop, try again with longer delay
            if (shouldContinueRef.current) {
              setTimeout(() => {
                if (shouldContinueRef.current) {
                  attemptRestart();
                }
              }, 1000);
            }
          }
        }
      } else {
        isRestartingRef.current = false;
      }
    }, restartDelay);
  };

  const startListening = () => {
    if (!recognitionRef.current || isListening) return;
    
    console.log(`Starting ${isMobileDevice ? 'mobile' : 'desktop'} recording...`);
    shouldContinueRef.current = true;
    setIsListening(true);
    setTranscript('');
    setAccumulatedTranscript('');
    setConfidence(0);
    
    try {
      recognitionRef.current.start();
      logEvent('voice_recording_start', { 
        language: selectedLanguage,
        isMobile: isMobileDevice
      });
    } catch (error) {
      console.error('Error starting recognition:', error);
      setTranscript('Error starting voice recognition. Please try again.');
      setIsListening(false);
      shouldContinueRef.current = false;
    }
  };

  const stopListening = () => {
    console.log('User stopping recording...');
    shouldContinueRef.current = false;
    
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
    }
    
    // Finalize immediately
    finalizeRecording();
  };

  const finalizeRecording = () => {
    setIsListening(false);
    isRestartingRef.current = false;
    
    const completeTranscript = accumulatedTranscript.trim();
    
    if (completeTranscript) {
      onTranscript(completeTranscript);
      logEvent('voice_recording_complete', { 
        length: completeTranscript.length, 
        language: selectedLanguage,
        isMobile: isMobileDevice
      });
    }
    
    setAccumulatedTranscript('');
    setTranscript('');
    setConfidence(0);
    
    logEvent('voice_recording_stop', { 
      language: selectedLanguage,
      isMobile: isMobileDevice
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
        
        {/* Device-specific tips */}
        <div className="accuracy-tips">
          <span className="tips-icon">💡</span>
          <small>
            {isMobileDevice ? (
              selectedLanguage.startsWith('si') 
                ? '📱 ජංගම: කෙටි වාක්‍ය කියන්න. දීර්ඝ නිශ්ශබ්දතාවය සඳහා නැවත ආරම්භ කරන්න.'
                : '📱 Mobile: Speak in shorter phrases. Restart for long pauses.'
            ) : (
              selectedLanguage.startsWith('si') 
                ? '🖥️ ඩෙස්ක්ටොප්: ඔබ නතර කරන තුරු අඛණ්ඩව පටිගත වේ.'
                : '🖥️ Desktop: Records continuously until you stop.'
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
              ? (selectedLanguage.startsWith('si') ? 'පටිගත කිරීම නවත්වන්න' : 'Stop Recording')
              : (selectedLanguage.startsWith('si') ? 'පටිගැනීම ආරම්භ කරන්න' : 'Start Recording')
            }
          </span>
        </button>
        
        {isListening && (
          <div className="listening-indicator">
            <div className="pulse-dot"></div>
            <span>
              {isMobileDevice ? (
                selectedLanguage.startsWith('si') 
                  ? '📱 ජංගම මාදිලිය...' 
                  : '📱 Mobile mode...'
              ) : (
                selectedLanguage.startsWith('si') 
                  ? '🖥️ අඛණ්ඩ මාදිලිය...' 
                  : '🖥️ Continuous mode...'
              )}
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