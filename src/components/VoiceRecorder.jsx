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
  
  // Session recording state
  const [isInSession, setIsInSession] = useState(false);
  const [sessionTranscript, setSessionTranscript] = useState('');
  const [sessionParts, setSessionParts] = useState([]);
  
  const recognitionRef = useRef(null);
  const dropdownRef = useRef(null);
  const currentTranscriptRef = useRef('');

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
    
    // Simple settings that work reliably
    recognitionRef.current.continuous = isMobile ? false : true;
    recognitionRef.current.interimResults = true;
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

      const currentText = finalTranscript + interimTranscript;
      setTranscript(currentText);
      setConfidence(bestConfidence || (interimTranscript ? 0.8 : 0));
      
      if (finalTranscript) {
        currentTranscriptRef.current = finalTranscript;
      }
    };

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      
      if (event.error === 'not-allowed') {
        setTranscript('Microphone access denied.');
      } else if (event.error === 'network') {
        setTranscript('Network error.');
      } else {
        setTranscript('Recognition error.');
      }
      
      logEvent('voice_recognition_error', { 
        error: event.error,
        language: selectedLanguage,
        isMobile
      });
    };

    recognitionRef.current.onend = () => {
      console.log('Recognition ended');
      setIsListening(false);
      
      // Add this segment to the session if we have content
      if (currentTranscriptRef.current.trim()) {
        const newPart = currentTranscriptRef.current.trim();
        
        if (isInSession) {
          // Add to session
          setSessionParts(prev => [...prev, newPart]);
          setSessionTranscript(prev => {
            const updated = prev + (prev ? ' ' : '') + newPart;
            return updated;
          });
          
          // On mobile, auto-prompt for continuation
          if (isMobile) {
            setTranscript('Tap Continue to add more, or Finish to save note.');
          }
        } else {
          // Single recording mode - send immediately
          onTranscript(newPart);
          logEvent('voice_transcript_complete', { 
            length: newPart.length, 
            language: selectedLanguage,
            isMobile
          });
        }
      } else if (isInSession && isMobile) {
        // No content captured but in session - prompt to continue
        setTranscript('No speech detected. Tap Continue to try again.');
      }
      
      currentTranscriptRef.current = '';
      setConfidence(0);
    };

    recognitionRef.current.onstart = () => {
      console.log('Recognition started');
      setTranscript('Listening...');
      currentTranscriptRef.current = '';
    };
  };

  const startSingleRecording = () => {
    if (!recognitionRef.current || isListening) return;
    
    setIsListening(true);
    setTranscript('Starting...');
    setConfidence(0);
    currentTranscriptRef.current = '';
    
    try {
      recognitionRef.current.start();
      logEvent('voice_recording_start', { 
        language: selectedLanguage,
        isMobile,
        mode: 'single'
      });
    } catch (error) {
      console.error('Error starting recognition:', error);
      setTranscript('Could not start recording.');
      setIsListening(false);
    }
  };

  const startSession = () => {
    setIsInSession(true);
    setSessionTranscript('');
    setSessionParts([]);
    startSingleRecording();
    
    logEvent('voice_session_start', { 
      language: selectedLanguage,
      isMobile
    });
  };

  const continueSession = () => {
    if (isInSession && !isListening) {
      startSingleRecording();
    }
  };

  const finishSession = () => {
    if (sessionTranscript.trim()) {
      onTranscript(sessionTranscript.trim());
      
      logEvent('voice_session_complete', { 
        length: sessionTranscript.length,
        parts: sessionParts.length,
        language: selectedLanguage,
        isMobile
      });
    }
    
    // Reset session
    setIsInSession(false);
    setSessionTranscript('');
    setSessionParts([]);
    setTranscript('');
  };

  const cancelSession = () => {
    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore
      }
    }
    
    setIsInSession(false);
    setSessionTranscript('');
    setSessionParts([]);
    setTranscript('');
    setIsListening(false);
    
    logEvent('voice_session_cancel', { 
      language: selectedLanguage,
      isMobile
    });
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
        setIsListening(false);
      }
    }
  };

  const handleLanguageSelect = (languageCode) => {
    if (isListening) {
      stopListening();
    }
    if (isInSession) {
      cancelSession();
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
            disabled={isListening || isInSession}
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
        
        {/* Explanation of mobile limitation */}
        <div className="accuracy-tips">
          <span className="tips-icon">💡</span>
          <small>
            {isMobile ? (
              selectedLanguage.startsWith('si') 
                ? '📱 ජංගම: නිශ්ශබ්දතාවයෙන් පසු නතර වේ. "සැසි" භාවිතයෙන් දීර්ඝ සටහන් සඳහා.'
                : '📱 Mobile: Stops after silence. Use "Session" for longer notes.'
            ) : (
              selectedLanguage.startsWith('si') 
                ? '🖥️ ඩෙස්ක්ටොප්: සාමාන්‍ය ශ්‍රව්‍ය සටහන්.'
                : '🖥️ Desktop: Standard voice recording.'
            )}
          </small>
        </div>
      </div>

      {/* Recording Controls */}
      <div className="recorder-container">
        {!isInSession ? (
          // Initial choice
          <div className="initial-controls">
            <button
              className="btn btn-primary"
              onClick={startSingleRecording}
              disabled={disabled || isListening}
            >
              🎙️ {selectedLanguage.startsWith('si') ? 'ඉක්මන් පටිගැනීම' : 'Quick Record'}
            </button>
            
            {isMobile && (
              <button
                className="btn btn-secondary"
                onClick={startSession}
                disabled={disabled || isListening}
              >
                🔗 {selectedLanguage.startsWith('si') ? 'සැසි ආරම්භ කරන්න' : 'Start Session'}
              </button>
            )}
          </div>
        ) : (
          // Session controls
          <div className="session-controls">
            {isListening ? (
              <button
                className="record-button recording"
                onClick={stopListening}
                disabled={disabled}
              >
                ⏹️ {selectedLanguage.startsWith('si') ? 'නවත්වන්න' : 'Stop'}
              </button>
            ) : (
              <div className="session-actions">
                <button
                  className="btn btn-primary"
                  onClick={continueSession}
                  disabled={disabled}
                >
                  ➕ {selectedLanguage.startsWith('si') ? 'දිගටම' : 'Continue'}
                </button>
                
                <button
                  className="btn btn-success"
                  onClick={finishSession}
                  disabled={!sessionTranscript.trim()}
                >
                  ✅ {selectedLanguage.startsWith('si') ? 'සම්පූර්ණ' : 'Finish'}
                </button>
                
                <button
                  className="btn btn-danger"
                  onClick={cancelSession}
                >
                  ❌ {selectedLanguage.startsWith('si') ? 'අවලංගු' : 'Cancel'}
                </button>
              </div>
            )}
          </div>
        )}
        
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
      
      {/* Session Progress */}
      {isInSession && sessionParts.length > 0 && (
        <div className="session-progress">
          <div className="session-info">
            <span className="session-label">
              {selectedLanguage.startsWith('si') ? 'සැසි:' : 'Session:'} {sessionParts.length} {selectedLanguage.startsWith('si') ? 'කොටස්' : 'parts'}
            </span>
          </div>
          <div className="session-preview">
            {sessionTranscript}
          </div>
        </div>
      )}
      
      {/* Live Transcript */}
      {transcript && transcript !== 'Starting...' && !isInSession && (
        <div className="transcript-preview">
          <label>
            {selectedLanguage.startsWith('si') ? 'සජීවී පිටපත:' : 'Live Transcript:'}
          </label>
          <p className={selectedLanguage.startsWith('si') ? 'sinhala-text' : ''}>{transcript}</p>
        </div>
      )}
      
      {/* Session transcript during recording */}
      {transcript && transcript !== 'Starting...' && isInSession && (
        <div className="transcript-preview">
          <label>
            {selectedLanguage.startsWith('si') ? 'වර්තමාන කොටස:' : 'Current Part:'}
          </label>
          <p className={selectedLanguage.startsWith('si') ? 'sinhala-text' : ''}>{transcript}</p>
        </div>
      )}
      
      <style jsx>{`
        .initial-controls {
          display: flex;
          gap: var(--spacing-sm);
          flex-wrap: wrap;
          justify-content: center;
        }
        
        .session-controls {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--spacing-md);
        }
        
        .session-actions {
          display: flex;
          gap: var(--spacing-sm);
          flex-wrap: wrap;
          justify-content: center;
        }
        
        .session-progress {
          margin-top: var(--spacing-md);
          padding: var(--spacing-md);
          background: var(--secondary-bg);
          border-radius: var(--radius-md);
          border-left: 3px solid var(--accent-color);
        }
        
        .session-info {
          margin-bottom: var(--spacing-sm);
        }
        
        .session-label {
          font-size: var(--font-size-sm);
          color: var(--text-secondary);
          font-weight: 600;
        }
        
        .session-preview {
          font-style: italic;
          color: var(--text-primary);
          line-height: 1.6;
        }
        
        .btn-secondary {
          background: var(--secondary-bg);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
        }
        
        .btn-secondary:hover {
          background: var(--card-hover-bg);
          border-color: var(--accent-color);
        }
        
        @media (max-width: 768px) {
          .initial-controls {
            flex-direction: column;
          }
          
          .session-actions {
            flex-direction: column;
            width: 100%;
          }
          
          .session-actions button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default VoiceRecorder;