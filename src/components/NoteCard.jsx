// File: /src/components/NoteCard.jsx
import React, { useState } from 'react';
import { formatDate } from '../utils/helpers';

const NoteCard = ({ note, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(note.title || '');
  const [editContent, setEditContent] = useState(note.content);

  // Detect if content contains Sinhala characters
  const containsSinhala = (text) => {
    return /[\u0D80-\u0DFF]/.test(text);
  };

  const handleSave = () => {
    onUpdate(note.id, {
      title: editTitle.trim() || 'Untitled Note',
      content: editContent.trim(),
      updatedAt: Date.now()
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(note.title || '');
    setEditContent(note.content);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this note?')) {
      onDelete(note.id);
    }
  };

  const displayTitle = note.title || 'Untitled Note';
  const displayDate = formatDate(note.updatedAt || note.createdAt);
  const isSinhalaContent = containsSinhala(note.content);
  const isSinhalaTitle = containsSinhala(displayTitle);

  return (
    <div className="note-card">
      {isEditing ? (
        <div className="edit-mode">
          <input
            type="text"
            className={`input title-input ${containsSinhala(editTitle) ? 'sinhala-text' : ''}`}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Note title..."
            autoFocus
          />
          <textarea
            className={`input textarea content-input ${containsSinhala(editContent) ? 'sinhala-text' : ''}`}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            placeholder="Note content..."
            rows={6}
          />
          <div className="edit-actions">
            <button className="btn btn-success btn-sm" onClick={handleSave}>
              ✅ Save
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleCancel}>
              ❌ Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="view-mode">
          <div className="note-header">
            <h3 className={`note-title ${isSinhalaTitle ? 'sinhala-text' : ''}`}>
              {displayTitle}
            </h3>
            <div className="note-meta">
              <span className="note-date">{displayDate}</span>
              {isSinhalaContent && <span className="language-badge">🇱🇰 SI</span>}
            </div>
          </div>
          <div className="note-content">
            <p className={isSinhalaContent ? 'sinhala-text' : ''}>{note.content}</p>
          </div>
          <div className="note-actions">
            <button 
              className="btn btn-ghost btn-sm" 
              onClick={() => setIsEditing(true)}
            >
              ✏️ Edit
            </button>
            <button 
              className="btn btn-danger btn-sm" 
              onClick={handleDelete}
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoteCard;