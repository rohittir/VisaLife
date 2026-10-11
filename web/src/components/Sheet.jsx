import { useEffect, useRef } from 'react';
import Icon from './Icon.jsx';

// Bottom sheet on a native modal <dialog>: Escape, focus trap (the page goes inert) and focus return come from the
// platform; the backdrop click is the only thing added here. `onClose` fires for every way of closing.
export default function Sheet({ title, eyebrow, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    const opener = document.activeElement;
    if (!d.open) d.showModal();
    // Unmounting without close() (the parent drops the sheet after Save) would leave focus on <body>.
    return () => opener?.isConnected && opener.focus?.();
  }, []);
  return (
    <dialog ref={ref} className="sheet" aria-label={title} onClose={onClose} onClick={(e) => e.target === ref.current && ref.current.close()}>
      <div className="sheet-body">
        <div className="sheet-head">
          <div>
            {eyebrow}
            <h2>{title}</h2>
          </div>
          <button type="button" className="sheet-close" aria-label="Close" onClick={() => ref.current.close()}>
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
