import Icon from './Icon.jsx';
import { sourceLabel } from '../lib/steps.js';

// The expanded body of a journey step (title, done toggle and expand control live on the row in Journey.jsx).
export default function Step({ step }) {
  return (
    <div className="step">
      {step.verify && <p className="note warn">Rules changed recently. Confirm with the source.</p>}
      <div className="step-body" dangerouslySetInnerHTML={{ __html: step.html }} />
      <ul className="link-list">
        {step.sources.map((u) => (
          <li key={u}>
            <a href={u} target="_blank" rel="noopener noreferrer">
              <span>{sourceLabel(u)}</span>
              <Icon name="external-link" size={18} />
            </a>
          </li>
        ))}
      </ul>
      <p className="meta">Reviewed {step.lastReviewed}</p>
    </div>
  );
}
