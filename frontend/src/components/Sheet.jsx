import { useEffect } from 'react';
import { X } from 'lucide-react';

// Bottom sheet on mobile, centered dialog on wider screens.
// With `header`, the title row and that header stay put and only the content
// below scrolls (for long reading sheets).
export default function Sheet({ open, onClose, title, header, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className={`sheet${header ? ' sheet-fixed-head' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="more-handle" />
        <div className="sheet-head">
          <h2 className="sheet-title">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>
        {header ? (
          <>
            {header}
            <div className="sheet-body">{children}</div>
          </>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
