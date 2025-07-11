// File: /src/App.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import WhisperVoiceRecorder from './components/WhisperVoiceRecorder';
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
import './App.css';

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
    logEvent('app_loaded', { notesCount: savedNotes.length, apiType: 'whisper' });
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

  // Handle voice transcript from Whisper
  const handleTranscript = (transcript) => {
    if (transcript.trim()) {
      const newNote = {
        id: generateId(),
        title: '',
        content: transcript.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source: 'whisper' // Mark as Whisper-generated
      };
      setNotes(prev => [newNote, ...prev]);
      logEvent('note_created_whisper', { contentLength: transcript.length });
    }
  };

  // Create new manual note
  const createNote = () => {
    const newNote = {
      id: generateId(),
      title: 'New Note',
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: 'manual'
    };
    setNotes(prev => [newNote, ...prev]);
    logEvent('note_created_manual');
  };

  // Update existing note
  const updateNote = (id, updates) => {
    setNotes(prev => prev.map(note => 
      note.id === id ? { ...note, ...updates, updatedAt: Date.now() } : note
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
    const filename = `voice-notes-whisper-${new Date().toISOString().split('T')[0]}.${format}`;
    exportToFile(content, filename, format === 'md' ? 'text/markdown' : 'text/plain');
    logEvent('notes_exported', { format, count: filteredNotes.length, apiType: 'whisper' });
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
      </div>
    );
  }

  return (
    <div className="app">
      <Header onExport={handleExport} notesCount={notes.length} />
      
      <main className="main-content">
        <div className="container">
          {/* Whisper Voice Recorder Section */}
          <section className="recorder-section">
            <WhisperVoiceRecorder onTranscript={handleTranscript} />
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
                    <span className="empty-icon">🎙️</span>
                    <h2>No notes yet</h2>
                    <p>Start by recording your first English voice note with Whisper AI or create a new note manually.</p>
                    <small>✨ Powered by OpenAI Whisper for professional English transcription</small>
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
    </div>
  );
}

export default App;