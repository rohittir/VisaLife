import { sourceLabel } from '../lib/steps.js';

export default function Step({ step, done, onToggle }) {
  return (
    <article className={`card check step${done ? ' done' : ''}`}>
      <h3>{step.title}</h3>
      {step.verify && <p className="badge">Rules changed recently. Confirm with the source.</p>}
      <div className="step-body" dangerouslySetInnerHTML={{ __html: step.html }} />
      <div className="links">
        {step.sources.map((u) => (
          <a key={u} href={u} target="_blank" rel="noopener noreferrer">
            {sourceLabel(u)} ↗
          </a>
        ))}
      </div>
      <label className="field row toggle">
        <input type="checkbox" checked={done} onChange={(e) => onToggle(step.id, e.target.checked)} />
        <span>Done</span>
      </label>
      <small className="reviewed">Reviewed {step.lastReviewed}</small>
    </article>
  );
}
