// File: /src/App.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import VoiceRecorder from './components/VoiceRecorder';
import NoteCard from './components/NoteCard';
import { 
  generateId, 
  storage, 
  formatNotesForExport, 
  exportToFile, 
  debounce,
  logEvent 
} from './utils/helpers';
import './styles/global.css';

const NOTES_STORAGE_KEY = 'voice-notes';

function App() {
  const [notes, setNotes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Load notes from localStorage on mount
  useEffect(() => {
    const savedNotes = storage.get(NOTES_STORAGE_KEY, []);
    setNotes(savedNotes);
    setIsLoading(false);
    logEvent('app_loaded', { notesCount: savedNotes.length });
  }, []);

  // Save notes to localStorage whenever notes change
  const saveNotes = useCallback(
    debounce((notesToSave) => {
      storage.set(NOTES_STORAGE_KEY, notesToSave);
    }, 500),
    []
  );

  useEffect(() => {
    if (!isLoading) {
      saveNotes(notes);
    }
  }, [notes, saveNotes, isLoading]);

  // Handle voice transcript
  const handleTranscript = (transcript) => {
    if (transcript.trim()) {
      const newNote = {
        id: generateId(),
        title: '',
        content: transcript.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      setNotes(prev => [newNote, ...prev]);
      logEvent('note_created_voice', { contentLength: transcript.length });
    }
  };

  // Create new manual note
  const createNote = () => {
    const newNote = {
      id: generateId(),
      title: 'New Note',
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setNotes(prev => [newNote, ...prev]);
    logEvent('note_created_manual');
  };

  // Update existing note
  const updateNote = (id, updates) => {
    setNotes(prev => prev.map(note => 
      note.id === id ? { ...note, ...updates } : note
    ));
    logEvent('note_updated', { noteId: id });
  };

  // Delete note
  const deleteNote = (id) => {
    setNotes(prev => prev.filter(note => note.id !== id));
    logEvent('note_deleted', { noteId: id });
  };

  // Export notes
  const handleExport = (format) => {
    const filteredNotes = getFilteredNotes();
    const content = formatNotesForExport(filteredNotes, format);
    const filename = `voice-notes-${new Date().toISOString().split('T')[0]}.${format}`;
    exportToFile(content, filename, format === 'md' ? 'text/markdown' : 'text/plain');
    logEvent('notes_exported', { format, count: filteredNotes.length });
  };

  // Filter notes based on search term
  const getFilteredNotes = () => {
    if (!searchTerm.trim()) return notes;
    
    const term = searchTerm.toLowerCase();
    return notes.filter(note => 
      note.title?.toLowerCase().includes(term) ||
      note.content.toLowerCase().includes(term)
    );
  };

  const filteredNotes = getFilteredNotes();

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p>Loading your notes...</p>
        </div>
        
        <style jsx>{`
          .loading-screen {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--primary-bg);
          }
          
          .loading-content {
            text-align: center;
          }
          
          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 4px solid var(--border-color);
            border-top: 4px solid var(--accent-color);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto var(--spacing-md);
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="app">
      <Header onExport={handleExport} notesCount={notes.length} />
      
      <main className="main-content">
        <div className="container">
          {/* Voice Recorder Section */}
          <section className="recorder-section">
            <VoiceRecorder onTranscript={handleTranscript} />
          </section>

          {/* Search and Create Section */}
          <section className="controls-section">
            <div className="search-container">
              <input
                type="text"
                className="input search-input"
                placeholder="Search notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="search-icon">🔍</span>
            </div>
            
            <button className="btn btn-primary" onClick={createNote}>
              ➕ New Note
            </button>
          </section>

          {/* Notes Section */}
          <section className="notes-section">
            {filteredNotes.length === 0 ? (
              <div className="empty-state">
                {notes.length === 0 ? (
                  <div className="empty-content">
                    <span className="empty-icon">📝</span>
                    <h2>No notes yet</h2>
                    <p>Start by recording your first voice note or create a new note manually.</p>
                  </div>
                ) : (
                  <div className="empty-content">
                    <span className="empty-icon">🔍</span>
                    <h2>No notes found</h2>
                    <p>Try adjusting your search term.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="notes-grid">
                {filteredNotes.map(note => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onUpdate={updateNote}
                    onDelete={deleteNote}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
      
      <style jsx>{`
        .app {
          min-height: 100vh;
          background: linear-gradient(135deg, var(--primary-bg) 0%, var(--secondary-bg) 100%);
        }
        
        .main-content {
          padding: var(--spacing-xl) 0;
        }
        
        .recorder-section {
          margin-bottom: var(--spacing-xl);
        }
        
        .controls-section {
          display: flex;
          gap: var(--spacing-md);
          align-items: center;
          margin-bottom: var(--spacing-xl);
        }
        
        .search-container {
          position: relative;
          flex-grow: 1;
        }
        
        .search-input {
          padding-right: 3rem;
        }
        
        .search-icon {
          position: absolute;
          right: var(--spacing-md);
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }
        
        .notes-section {
          min-height: 400px;
        }
        
        .notes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: var(--spacing-lg);
          animation: fadeIn 0.5s ease-out;
        }
        
        .empty-state {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 400px;
        }
        
        .empty-content {
          text-align: center;
          max-width: 400px;
        }
        
        .empty-icon {
          font-size: 4rem;
          display: block;
          margin-bottom: var(--spacing-md);
        }
        
        .empty-content h2 {
          color: var(--text-secondary);
          margin-bottom: var(--spacing-sm);
          font-size: var(--font-size-2xl);
        }
        
        .empty-content p {
          color: var(--text-muted);
          line-height: 1.6;
        }
        
        @media (max-width: 768px) {
          .main-content {
            padding: var(--spacing-lg) 0;
          }
          
          .controls-section {
            flex-direction: column;
            align-items: stretch;
            gap: var(--spacing-sm);
          }
          
          .notes-grid {
            grid-template-columns: 1fr;
            gap: var(--spacing-md);
          }
          
          .empty-content h2 {
            font-size: var(--font-size-xl);
          }
        }
        
        @media (max-width: 480px) {
          .notes-grid {
            gap: var(--spacing-sm);
          }
        }
      `}</style>
    </div>
  );
}

export default App;