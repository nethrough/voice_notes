// File: /src/components/Header.jsx
import React from 'react';

const Header = ({ onExport, notesCount }) => {
  const handleExportTxt = () => {
    onExport('txt');
  };

  const handleExportMd = () => {
    onExport('md');
  };

  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <div className="logo-section">
            <h1 className="logo">
              <span className="logo-icon">🎙️</span>
              Voice Notes AI
            </h1>
            <span className="notes-count">
              {notesCount} {notesCount === 1 ? 'note' : 'notes'}
            </span>
          </div>
          
          {notesCount > 0 && (
            <div className="export-buttons">
              <button 
                className="btn btn-ghost btn-sm" 
                onClick={handleExportTxt}
                title="Export as TXT"
              >
                📄 TXT
              </button>
              <button 
                className="btn btn-ghost btn-sm" 
                onClick={handleExportMd}
                title="Export as Markdown"
              >
                📝 MD
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;