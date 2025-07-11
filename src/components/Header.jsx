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
              Voice Notes
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
      
      <style jsx>{`
        .header {
          background: var(--secondary-bg);
          border-bottom: 1px solid var(--border-color);
          padding: var(--spacing-lg) 0;
          position: sticky;
          top: 0;
          z-index: 100;
          backdrop-filter: blur(10px);
        }
        
        .header-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--spacing-md);
        }
        
        .logo-section {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        }
        
        .logo {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          font-size: var(--font-size-2xl);
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }
        
        .logo-icon {
          font-size: var(--font-size-3xl);
          animation: pulse 3s infinite;
        }
        
        .notes-count {
          font-size: var(--font-size-sm);
          color: var(--text-muted);
          background: var(--card-bg);
          padding: var(--spacing-xs) var(--spacing-sm);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-color);
        }
        
        .export-buttons {
          display: flex;
          gap: var(--spacing-sm);
        }
        
        @media (max-width: 768px) {
          .header {
            padding: var(--spacing-md) 0;
          }
          
          .logo {
            font-size: var(--font-size-xl);
          }
          
          .logo-icon {
            font-size: var(--font-size-2xl);
          }
          
          .notes-count {
            display: none;
          }
          
          .export-buttons {
            flex-direction: column;
            gap: var(--spacing-xs);
          }
        }
        
        @media (max-width: 480px) {
          .header-content {
            flex-direction: column;
            align-items: flex-start;
            gap: var(--spacing-sm);
          }
          
          .export-buttons {
            flex-direction: row;
            width: 100%;
            justify-content: space-between;
          }
        }
      `}</style>
    </header>
  );
};

export default Header;