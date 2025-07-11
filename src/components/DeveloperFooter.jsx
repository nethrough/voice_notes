// File: /src/components/DeveloperFooter.jsx
import React, { useEffect, useRef, useState } from 'react';

const DeveloperFooter = () => {
  const currentYear = new Date().getFullYear();
  const footerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  const techStack = ['React', 'Whisper AI', 'JavaScript', 'CSS3'];
  
const socialLinks = [
    { name: 'GitHub', url: 'https://github.com/nethrough', icon: '💻' },
    { name: 'Portfolio', url: 'https://yourportfolio.com', icon: '🌐' },
    { name: 'LinkedIn', url: 'https://www.linkedin.com/in/n-wickramasinghe/', icon: '💼' },
    { name: 'Email', url: 'mailto:nethroughwickramasinghe@yahoo.com', icon: '📧' }
  ];

  // FIXED: Safe Intersection Observer
  useEffect(() => {
    if (!footerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Additional safety check
        if (entry.target && document.contains(entry.target) && entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { 
        threshold: 0.1,
        rootMargin: '50px' // Start animation slightly before element is visible
      }
    );

    // Only observe if element exists
    const footerElement = footerRef.current;
    if (footerElement) {
      observer.observe(footerElement);
    }

    return () => {
      if (observer && footerElement) {
        observer.unobserve(footerElement);
      }
      observer.disconnect();
    };
  }, []); // Empty dependency array since we're using ref

  // FIXED: Safe scroll to top function
  const handleScrollToTop = () => {
    try {
      window.scrollTo({
        top: 0, 
        behavior: 'smooth'
      });
    } catch (error) {
      // Fallback for older browsers
      window.scrollTo(0, 0);
    }
  };

  // FIXED: Safe link handler for external links
  const handleExternalLink = (url, event) => {
    try {
      // Check if we're in a sandboxed iframe
      if (window.parent !== window && window.location !== window.parent.location) {
        event.preventDefault();
        // Handle sandbox environment
        console.warn('External links may be blocked in sandboxed environment');
        return false;
      }
    } catch (error) {
      // Cross-origin frame access error - we're probably in an iframe
      event.preventDefault();
      console.warn('Link blocked due to iframe restrictions');
      return false;
    }
  };

  return (
    <footer 
      ref={footerRef}
      className={`minimal-footer ${isVisible ? 'visible' : ''}`}
    >
      <div className="footer-container">
        {/* Developer Info */}
        <div className="footer-header">
          <div className="developer-info">
            <h3 className="developer-name">Nethrough Wickramasinghe</h3>
            <p className="developer-title">Full Stack Developer</p>
          </div>
          <div className="footer-status">
            <span className="status-dot"></span>
            <span className="status-text">Available</span>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="footer-tech">
          <span className="tech-label">Built with:</span>
          <div className="tech-tags">
            {techStack.map((tech, index) => (
              <span key={index} className="tech-tag">{tech}</span>
            ))}
          </div>
        </div>

        {/* Social Links */}
        <div className="footer-social">
          {socialLinks.map((link, index) => (
            <a
              key={index}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
              title={link.name}
              onClick={(e) => handleExternalLink(link.url, e)}
            >
              <span className="social-icon">{link.icon}</span>
              <span className="social-name">{link.name}</span>
            </a>
          ))}
        </div>

        {/* Copyright */}
        <div className="footer-bottom">
          <p className="copyright">
            &copy; {currentYear} Nethrough Wickramasinghe. All rights reserved.
          </p>
          <button 
            className="scroll-top"
            onClick={handleScrollToTop}
            aria-label="Scroll to top"
            type="button"
          >
            ↑
          </button>
        </div>
      </div>
    </footer>
  );
};

export default DeveloperFooter;