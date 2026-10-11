import { formatDate } from '../lib/dates.js';
import Icon from './Icon.jsx';
import Sheet from './Sheet.jsx';

const host = (u) => new URL(u).hostname.replace(/^www\./, '');

// Detail for one check: situation chip, headline, the long question, why it matters, official links, answers.
// `extra` is an optional inline control (the exact-day input) shown above the links.
export default function CheckSheet({ check, state, done, onAnswer, onClose, extra }) {
  const no = state?.answer === 'no';
  const answer = (a) => {
    onAnswer(check.id, a);
    onClose();
  };
  return (
    <Sheet title={check.short} eyebrow={<span className="chip">{check.title}</span>} onClose={onClose}>
      <p>{check.ask}</p>
      {check.verify && (
        <p className="note warn">Rules changed recently. Confirm with the source.</p>
      )}
      <div className="why">
        <span className="label">Why it matters</span>
        <p>{check.why}</p>
      </div>
      {extra}
      <ul className="link-list">
        {check.links.map((l) => (
          <li key={l.url}>
            <a href={l.url} target="_blank" rel="noopener noreferrer">
              <span>{l.label}</span>
              <Icon name="external-link" size={18} />
            </a>
          </li>
        ))}
      </ul>
      <div className="actions stacked">
        {done ? (
          <button type="button" className="btn outline" onClick={() => answer(null)}>Undo</button>
        ) : (
          <>
            <button type="button" className="btn primary" onClick={() => answer('yes')}>Yes, done</button>
            <button type="button" className="btn outline" aria-pressed={no} onClick={() => answer(no ? null : 'no')}>
              {no ? 'Marked not yet' : 'Not yet'}
            </button>
          </>
        )}
      </div>
      <p className="meta">Reviewed {formatDate(check.lastReviewed)} · {host(check.sources[0])}</p>
    </Sheet>
  );
}
