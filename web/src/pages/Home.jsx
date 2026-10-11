import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../lib/profile.jsx';
import { CHECKS, VISAS, stageOf } from '../lib/content.js';
import { evaluate, resetForSituation } from '../lib/checks.js';
import { daysUntil, formatDate } from '../lib/dates.js';
import CheckCard from '../components/CheckCard.jsx';

// Dates that are history, not deadlines.
const NOT_DEADLINES = new Set(['h1bFirstStart', 'priorityDate', 'i140ApprovedOn', 'primaryI140ApprovedOn', 'i485FiledOn', 'optStart', 'stemOptStart', 'travelSignatureDate']);

function statusLine(profile) {
  const d = profile.dates;
  const key = profile.visa === 'F1' ? (d.stemOptEnd ? 'stemOptEnd' : d.optEnd ? 'optEnd' : 'programEnd') : 'i94Expiry';
  return d[key] ? `${VISAS.fields[key].label}: ${formatDate(d[key])}` : null;
}

function nextDeadline(profile, today = new Date()) {
  return Object.entries(profile.dates)
    .filter(([k, v]) => VISAS.fields[k]?.type === 'date' && v && !NOT_DEADLINES.has(k) && daysUntil(v, today) >= 0)
    .map(([k, v]) => ({ k, v, days: daysUntil(v, today) }))
    .sort((a, b) => a.days - b.days)[0];
}

export default function Home() {
  const { profile, update } = useProfile();
  const [showAll, setShowAll] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const { open, done } = useMemo(() => evaluate(profile, CHECKS), [profile]);
  const situations = VISAS.situations.filter((s) => s.visas.includes(profile.visa));
  const stage = stageOf(profile.visa, profile.stage);
  const deadline = nextDeadline(profile);
  const visible = showAll ? open : open.slice(0, 7);

  const toggle = (id) =>
    update((p) => {
      const on = !p.situations.includes(id);
      return {
        situations: on ? [...p.situations, id] : p.situations.filter((s) => s !== id),
        checks: on ? resetForSituation(CHECKS, id, p.checks) : p.checks,
      };
    });
  const answer = (id, a) =>
    update((p) => ({ checks: { ...p.checks, [id]: a ? { answer: a, at: new Date().toISOString() } : undefined } }));

  return (
    <>
      <header className="status">
        <h1>{VISAS.visas[profile.visa].label} · {stage?.label}</h1>
        <p>{statusLine(profile) ?? <Link to="/me">Add your dates to get countdowns</Link>}</p>
      </header>

      <section>
        <h2 className="eyebrow">What's going on?</h2>
        <div className="chips">
          {situations.map((s) => {
            const on = profile.situations.includes(s.id);
            return (
              <button key={s.id} className={on ? 'chip on' : 'chip'} aria-pressed={on} onClick={() => toggle(s.id)}>
                {s.label}
              </button>
            );
          })}
        </div>
      </section>

      {deadline && (
        <section className="card deadline">
          <span className="eyebrow">Next deadline</span>
          <strong>{VISAS.fields[deadline.k].label}</strong>
          <span>{deadline.days === 0 ? 'Today' : `In ${deadline.days} days`} · {formatDate(deadline.v)}</span>
        </section>
      )}

      <section>
        <h2>Check now <span className="count">{open.length}</span></h2>
        {open.length === 0 && <p className="card muted">Nothing to check right now. Tap what's going on above, or add dates in Me.</p>}
        {visible.map((c) => (
          <CheckCard key={c.id} check={c} state={profile.checks[c.id]} onAnswer={answer} />
        ))}
        {!showAll && open.length > visible.length && (
          <button className="link" onClick={() => setShowAll(true)}>Show all {open.length}</button>
        )}
        {done.length > 0 && (
          <button className="link" onClick={() => setShowDone((v) => !v)}>
            {showDone ? 'Hide' : 'Show'} {done.length} done
          </button>
        )}
        {showDone && done.map((c) => <CheckCard key={c.id} check={c} state={profile.checks[c.id]} onAnswer={answer} done />)}
      </section>
    </>
  );
}
