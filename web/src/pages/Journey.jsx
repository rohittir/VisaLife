import { useState } from 'react';
import { useProfile } from '../lib/profile.jsx';
import { VISAS } from '../lib/content.js';
import { JOURNEYS, STEPS } from '../lib/journeys.js';
import { groupBySection, visibleSteps } from '../lib/steps.js';
import FieldInput from '../components/FieldInput.jsx';
import Icon from '../components/Icon.jsx';
import Step from '../components/Step.jsx';

export default function Journey() {
  const { profile, update } = useProfile();
  const stages = VISAS.visas[profile.visa].stages;
  const journey = JOURNEYS[profile.visa];
  const cur = Math.max(0, stages.findIndex((s) => s.id === profile.stage));
  const [shown, setShown] = useState(cur);
  const [openId, setOpenId] = useState(null);
  const stage = stages[shown];
  const next = stages[shown + 1];
  const isDone = (id) => profile.checks[id]?.answer === 'yes';
  // Step done-state lives in profile.checks next to check answers; the validator keeps the ids distinct.
  const toggle = (id) =>
    update((p) => ({ checks: { ...p.checks, [id]: isDone(id) ? undefined : { answer: 'yes', at: new Date().toISOString() } } }));
  const idsOf = (stageId) => journey?.stages.find((s) => s.id === stageId)?.steps ?? [];
  const ids = idsOf(stage.id);

  const stepRows = (list) => (
    <ul className="list">
      {list.map((id) => {
        const step = STEPS[id];
        const open = openId === id;
        return (
          <li key={id}>
            <div className="step-row">
              <button type="button" className={`tick${isDone(id) ? ' on' : ''}`} aria-pressed={isDone(id)} aria-label={`Done: ${step.title}`} onClick={() => toggle(id)}>
                <span><Icon name="check" size={16} /></span>
              </button>
              <button type="button" className="row" aria-expanded={open} aria-controls={`step-${id}`} onClick={() => setOpenId(open ? null : id)}>
                <span className="row-text">{step.title}</span>
                <span className="chev"><Icon name={open ? 'chevron-down' : 'chevron-right'} size={18} /></span>
              </button>
            </div>
            {open && (
              <div id={`step-${id}`}>
                <Step step={step} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  // Leaving the USA is not a stage in a line: its own layout, with sections and steps that depend on the destination.
  if (profile.stage === 'leaving' && journey) {
    const field = VISAS.fields.leavingTo;
    const to = profile.dates.leavingTo;
    const shownSteps = visibleSteps(idsOf('leaving').map((id) => STEPS[id]), to);
    return (
      <>
        <h1>Journey</h1>
        <section className="card" aria-label="Leaving the USA">
          <h2>{stages[cur].label}</h2>
          <p className="muted">{shownSteps.filter((s) => isDone(s.id)).length} of {shownSteps.length} steps done</p>
          <FieldInput field={field} value={to} onChange={(v) => update((p) => ({ dates: { ...p.dates, leavingTo: v || undefined } }))} />
          {!field.options.includes(to) && <p className="label">Some steps only apply to one destination. Pick one to see them.</p>}
        </section>
        {groupBySection(shownSteps).map((g) => (
          <section key={g.steps[0].id} className="section">
            {g.section && <h2>{g.section}</h2>}
            {stepRows(g.steps.map((s) => s.id))}
          </section>
        ))}
      </>
    );
  }

  return (
    <>
      <h1>Journey</h1>

      <section className="card stepper" aria-label="Stages">
        <ol>
          {stages.map((s, i) => (
            <li key={s.id} className={i < cur ? 'done' : i === cur ? 'current' : 'future'}>
              <button type="button" aria-current={i === shown ? 'step' : undefined} aria-label={`Stage ${i + 1}: ${s.label}${i === cur ? ' (you are here)' : i < cur ? ' (past)' : ''}`} onClick={() => setShown(i)}>
                <span className="dot">{i < cur && <Icon name="check" size={14} />}</span>
              </button>
            </li>
          ))}
        </ol>
        <p className="label">Stage {shown + 1} of {stages.length}{shown === cur ? ' · You are here' : ''}</p>
        <h2>{stage.label}</h2>
        {journey ? (
          <p className="muted">{ids.filter(isDone).length} of {ids.length} steps done</p>
        ) : (
          <p className="muted">{stage.hint}</p>
        )}
      </section>

      {journey ? (
        <>
          {ids.length > 0 ? stepRows(ids) : <p className="card muted">Nothing to do in this stage yet.</p>}
          {next && (
            <button type="button" className="next" onClick={() => { setShown(shown + 1); setOpenId(null); }}>
              <span>
                <span className="label">Next</span>
                <strong>{next.label}</strong>
              </span>
              <span className="chev"><Icon name="chevron-right" size={18} /></span>
            </button>
          )}
          {journey.groups?.map((g) => (
            <section key={g.label} className="section">
              <h2>{g.label} <span className="muted">· {g.steps.filter(isDone).length} of {g.steps.length} done</span></h2>
              {stepRows(g.steps)}
            </section>
          ))}
        </>
      ) : (
        <>
          <ol className="list">
            {stages.map((s, i) => (
              <li key={s.id}>
                <div className="row static">
                  <span className={`ico ${i < cur ? 'done' : ''}`}><Icon name={i < cur ? 'check' : 'route'} /></span>
                  <span className="row-text">
                    <strong>{s.label}</strong>
                    <br />
                    <span className="label">{i === cur ? 'You are here' : s.hint}</span>
                  </span>
                </div>
              </li>
            ))}
          </ol>
          <p className="muted">Step-by-step guidance for each stage is being written. Your checks on Today already cover the time-critical parts.</p>
        </>
      )}
    </>
  );
}
