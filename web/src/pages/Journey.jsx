import { useProfile } from '../lib/profile.jsx';
import { VISAS } from '../lib/content.js';
import { JOURNEYS, STEPS } from '../lib/journeys.js';
import Step from '../components/Step.jsx';

export default function Journey() {
  const { profile, update } = useProfile();
  const stages = VISAS.visas[profile.visa].stages;
  const journey = JOURNEYS[profile.visa];
  const isDone = (id) => profile.checks[id]?.answer === 'yes';
  // Step done-state lives in profile.checks next to check answers; the validator keeps the ids distinct.
  const toggle = (id, on) =>
    update((p) => ({ checks: { ...p.checks, [id]: on ? { answer: 'yes', at: new Date().toISOString() } : undefined } }));

  if (!journey) {
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

  const stepsOf = Object.fromEntries(journey.stages.map((s) => [s.id, s.steps]));
  const section = (title, hint, ids, open) => (
    <details className="stage" open={open}>
      <summary>
        <strong>{title}</strong>
        <small>{hint ? `${hint} · ` : ''}{ids.filter(isDone).length} of {ids.length} done</small>
      </summary>
      {ids.map((id) => <Step key={id} step={STEPS[id]} done={isDone(id)} onToggle={toggle} />)}
    </details>
  );

  return (
    <>
      <h1>Journey</h1>
      <ol className="timeline">
        {stages.map((s) => (
          <li key={s.id} className={s.id === profile.stage ? 'current' : ''}>
            {section(s.label, s.id === profile.stage ? 'You are here' : s.hint, stepsOf[s.id] ?? [], s.id === profile.stage)}
          </li>
        ))}
      </ol>
      {journey.groups?.map((g) => (
        <div key={g.label} className="group">
          {section(g.label, '', g.steps, false)}
        </div>
      ))}
    </>
  );
}
