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
      
      <style jsx>{`
        .note-card {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: var(--spacing-lg);
          transition: all var(--transition-normal);
          animation: fadeIn 0.3s ease-out;
        }
        
        .note-card:hover {
          background: var(--card-hover-bg);
          border-color: var(--accent-color);
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
        }
        
        .note-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: var(--spacing-md);
          gap: var(--spacing-sm);
        }
        
        .note-title {
          font-size: var(--font-size-lg);
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
          word-wrap: break-word;
          flex-grow: 1;
        }
        
        .note-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: var(--spacing-xs);
        }
        
        .note-date {
          font-size: var(--font-size-xs);
          color: var(--text-muted);
          white-space: nowrap;
          background: var(--secondary-bg);
          padding: var(--spacing-xs) var(--spacing-sm);
          border-radius: var(--radius-sm);
        }
        
        .language-badge {
          font-size: var(--font-size-xs);
          background: linear-gradient(135deg, #ff6b35, #f7931e);
          color: white;
          padding: var(--spacing-xs) var(--spacing-sm);
          border-radius: var(--radius-sm);
          font-weight: 500;
          white-space: nowrap;
        }
        
        .note-content {
          margin-bottom: var(--spacing-md);
        }
        
        .note-content p {
          color: var(--text-secondary);
          line-height: 1.6;
          margin: 0;
          word-wrap: break-word;
          white-space: pre-wrap;
        }
        
        .sinhala-text {
          font-family: 'Noto Sans Sinhala', 'Iskoola Pota', 'FM Malithi', sans-serif !important;
          line-height: 1.8 !important;
          letter-spacing: 0.3px;
        }
        
        .note-actions {
          display: flex;
          gap: var(--spacing-sm);
          justify-content: flex-end;
          border-top: 1px solid var(--border-color);
          padding-top: var(--spacing-md);
        }
        
        .edit-mode {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }
        
        .title-input {
          font-weight: 600;
          font-size: var(--font-size-lg);
        }
        
        .content-input {
          font-family: inherit;
          resize: vertical;
        }
        
        .edit-actions {
          display: flex;
          gap: var(--spacing-sm);
          justify-content: flex-end;
        }
        
        @media (max-width: 768px) {
          .note-card {
            padding: var(--spacing-md);
          }
          
          .note-header {
            flex-direction: column;
            align-items: flex-start;
            gap: var(--spacing-xs);
          }
          
          .note-meta {
            flex-direction: row;
            align-items: center;
            align-self: stretch;
            justify-content: space-between;
          }
          
          .note-actions {
            flex-direction: column;
            align-items: stretch;
          }
          
          .edit-actions {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `}</style>
    </div>
  );
};

export default NoteCard;