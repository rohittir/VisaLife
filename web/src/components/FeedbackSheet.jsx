import { createContext, useContext, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useProfile } from '../lib/profile.jsx';
import { CATEGORIES, MAX, feedbackContext, submitFeedback, validateFeedback } from '../lib/feedback.js';
import Icon from './Icon.jsx';
import Sheet from './Sheet.jsx';

// One sheet, opened from the Me card and from the link under every tab's disclaimer. The draft lives here, not in the
// sheet, so a tap on the backdrop does not throw away what someone typed.
const BLANK = { category: 'suggestion', message: '', include: true };
const Open = createContext(() => {});
export const useFeedback = () => useContext(Open);

const NOTE = {
  sending: 'Sending…',
  failed: "Couldn't send. Check your connection and try again.",
  rate: 'Too many messages right now. Try again in a minute.',
};

function FeedbackSheet({ draft, setDraft, onClose }) {
  const { profile } = useProfile();
  const { pathname } = useLocation();
  const honeypot = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | sending | sent | failed | rate
  const { category, message, include } = draft;
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const valid = validateFeedback({ category, message }).ok;
  const sending = status === 'sending';

  const send = async () => {
    setStatus('sending');
    const result = await submitFeedback({
      category,
      message: message.trim(),
      honeypot: honeypot.current?.value ?? '',
      ...(include && { context: feedbackContext(profile, pathname) }),
    });
    if (result.ok) setDraft(BLANK);
    setStatus(result.ok ? 'sent' : result.reason === 'rate' ? 'rate' : 'failed');
  };

  return (
    <Sheet title="Send feedback" onClose={onClose}>
      {status === 'sent' ? (
        <>
          <p role="status">Thank you. Your feedback was sent.</p>
          <button type="button" className="btn primary wide" onClick={onClose}>Close</button>
        </>
      ) : (
        <>
          <p className="sheet-hint">Anonymous. We never ask who you are. Please don't include names, receipt numbers or A-numbers. Anonymous feedback can't be removed later because nothing links it to you.</p>
          <fieldset className="field">
            <legend>What is it about?</legend>
            <div className="chips">
              {CATEGORIES.map(([id, label]) => (
                <button key={id} type="button" className="chip-btn" aria-pressed={category === id} onClick={() => set({ category: id })}>
                  <span className="chip">{category === id && <Icon name="check" size={14} />}{label}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <label className="field">
            <span>Your message</span>
            <textarea value={message} maxLength={MAX} onChange={(e) => set({ message: e.target.value })} aria-describedby="feedback-count" />
            <span id="feedback-count" className="meta">{message.length} / {MAX}</span>
          </label>
          <label className="field check">
            <input type="checkbox" checked={include} onChange={(e) => set({ include: e.target.checked })} />
            <span>Include my visa and stage</span>
          </label>
          {/* Bots fill every input; people never see this one. */}
          <div className="hp" aria-hidden="true">
            <input ref={honeypot} name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" defaultValue="" />
          </div>
          <button type="button" className="btn primary wide" disabled={!valid || sending} onClick={send}>Send</button>
          <p role="status" className="muted">{NOTE[status] ?? ''}</p>
        </>
      )}
    </Sheet>
  );
}

export function FeedbackProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(BLANK);
  return (
    <Open.Provider value={() => setOpen(true)}>
      {children}
      {open && <FeedbackSheet draft={draft} setDraft={setDraft} onClose={() => setOpen(false)} />}
    </Open.Provider>
  );
}

export function FeedbackLink() {
  const open = useFeedback();
  return (
    <button type="button" className="btn-text feedback-link" onClick={open}>Send feedback</button>
  );
}
