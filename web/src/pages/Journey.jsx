import { useProfile } from '../lib/profile.jsx';
import { VISAS } from '../lib/content.js';

export default function Journey() {
  const { profile } = useProfile();
  const stages = VISAS.visas[profile.visa].stages;
  return (
    <>
      <h1>Journey</h1>
      <ol className="timeline">
        {stages.map((s) => (
          <li key={s.id} className={s.id === profile.stage ? 'current' : ''}>
            <strong>{s.label}</strong>
            <small>{s.hint}</small>
          </li>
        ))}
      </ol>
      <p className="muted">Step-by-step guidance for each stage is being written. Your checks on Home already cover the time-critical parts.</p>
    </>
  );
}
