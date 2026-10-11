import { useMemo, useState } from 'react';
import { useProfile } from '../lib/profile.jsx';
import { BULLETINS, CHECKS, VISAS, stageOf } from '../lib/content.js';
import { status } from '../lib/bulletin.js';
import { evaluate, resetForSituation, supportLine } from '../lib/checks.js';
import { daysUntil, formatDate, isMonth, monthsLabel, resolveDates, unemploymentRemaining } from '../lib/dates.js';
import CheckSheet from '../components/CheckSheet.jsx';
import Icon from '../components/Icon.jsx';
import JitPrompt, { nextPrompt } from '../components/JitPrompt.jsx';
import PDMeter, { ExactDay } from '../components/PDMeter.jsx';
import Sheet from '../components/Sheet.jsx';

const days = (n) => (n === 0 ? 'Today' : `${n} day${n === 1 ? '' : 's'}`);
// A month-only date is shown in months: a day count would claim precision we do not have.
const left = (raw, n, today) => (isMonth(raw) ? monthsLabel(raw, today) : days(n));

// Icon and tint by what a check is about. Time-bound checks use the calendar icon (yellow soon, red past due).
function look(c) {
  const w = JSON.stringify(c.when);
  if (w.includes('"datePast"')) return { icon: 'calendar', tone: 'over' };
  if (/"(dateWithin|season|computed|pdCurrent|pdAmbiguous)"/.test(w)) return { icon: 'calendar', tone: 'warn' };
  if (/travel|stamp|appointment/.test(c.id)) return { icon: 'plane', tone: '' };
  if (/i94|passport|ssn|ead|account|uscis|sevp|i485|i140|itin|cards/.test(c.id)) return { icon: 'id-card', tone: '' };
  return { icon: 'gavel', tone: '' };
}

function CheckRow({ check, state, done, onOpen }) {
  const { icon, tone } = done ? { icon: 'check', tone: 'done' } : look(check);
  return (
    <li>
      <button type="button" className="row" onClick={() => onOpen(check.id)}>
        <span className={`ico ${tone}`}><Icon name={icon} /></span>
        <span className="row-text">{check.short}</span>
        {!done && tone === 'over' && <span className="row-meta over">Past due</span>}
        {state?.answer === 'no' && !done && <span className="row-meta">Not yet</span>}
        <span className="chev"><Icon name="chevron-right" size={18} /></span>
      </button>
    </li>
  );
}

// Nearest dated deadline (fields marked `deadline` in visas.json), from the resolved dates.
function nextDeadline(dates, today) {
  return Object.entries(dates)
    .filter(([k]) => VISAS.fields[k]?.deadline)
    .map(([k, v]) => ({ k, n: daysUntil(v, today) }))
    .filter((d) => d.n >= 0)
    .sort((a, b) => a.n - b.n)[0];
}

// F-1 on OPT / STEM OPT: unemployment days left when known, else days to the OPT / STEM end date.
function f1Tile(profile, dates, today, deadline) {
  const stem = profile.stage === 'stem_opt';
  if (!stem && profile.stage !== 'opt') return null;
  const used = profile.dates.unemploymentDaysUsed;
  if (used != null && used !== '') {
    return { label: 'Unemployment days', big: days(Math.max(0, unemploymentRemaining(used, stem))), sub: `left of ${stem ? 150 : 90}` };
  }
  const k = stem ? 'stemOptEnd' : 'optEnd';
  if (dates[k] && k !== deadline?.k && daysUntil(dates[k], today) >= 0) {
    return { label: VISAS.fields[k].label, big: left(profile.dates[k], daysUntil(dates[k], today), today), sub: formatDate(profile.dates[k]) };
  }
  return null;
}

export default function Home() {
  const { profile, update } = useProfile();
  const [sel, setSel] = useState(null);
  const [changing, setChanging] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const today = useMemo(() => new Date(), []);
  const dates = useMemo(() => resolveDates(profile.dates, VISAS.fields, today), [profile.dates, today]);
  // Checks and the bulletin only ever see full dates; rawDates keeps what was entered (for the exact-day case).
  const { open, done } = useMemo(
    () => evaluate({ ...profile, dates, rawDates: profile.dates }, CHECKS, today, BULLETINS),
    [profile, dates, today],
  );
  const stage = stageOf(profile.visa, profile.stage);
  const situations = VISAS.situations.filter((s) => s.visas.includes(profile.visa));
  const active = situations.filter((s) => profile.situations.includes(s.id));
  // "Not yet" keeps a check open, so the hero moves on to one that has not been put off.
  const hero = open.find((c) => profile.checks[c.id]?.answer !== 'no') ?? open[0];
  const rest = open.filter((c) => c !== hero);
  const selected = CHECKS.find((c) => c.id === sel);

  const deadline = nextDeadline(dates, today);
  const pd = ['H1B', 'H4'].includes(profile.visa) && dates.priorityDate && dates.ebCategory && status(BULLETINS, dates.priorityDate, dates.ebCategory);
  const f1 = profile.visa === 'F1' ? f1Tile(profile, dates, today, deadline) : null;
  const prompt = nextPrompt(stage, profile, today);
  // A month-only expiry whose month is this month: only the day says whether it has passed. Asked once, in place of the prompt.
  const thisMonth = today.toISOString().slice(0, 7);
  const dayField = Object.keys(profile.dates).find(
    (k) => VISAS.fields[k]?.deadline && VISAS.fields[k].assume === 'end' && profile.dates[k] === thisMonth && !profile.dismissed?.includes(`day:${k}`),
  );

  const setDate = (k, v) => update((p) => ({ dates: { ...p.dates, [k]: v || undefined } }));
  const dismiss = (key) => update((p) => ({ dismissed: [...(p.dismissed ?? []), key] }));
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

  const rows = (list, isDone) =>
    list.map((c) => <CheckRow key={c.id} check={c} state={profile.checks[c.id]} done={isDone} onOpen={setSel} />);

  return (
    <>
      <header className="top">
        <h1>Today</h1>
        <span className="chip">{VISAS.visas[profile.visa].label} · {stage?.label}</span>
      </header>

      <div className="chip-row">
        {active.map((s) => (
          <button key={s.id} type="button" className="chip-btn" aria-label={`Remove: ${s.label}`} onClick={() => toggle(s.id)}>
            <span className="chip">{s.label}<Icon name="x" size={14} /></span>
          </button>
        ))}
        <button type="button" className="btn quiet" onClick={() => setChanging(true)}>Something changed?</button>
      </div>

      {hero ? (
        <section className="hero" aria-labelledby="hero-title">
          <span className="label">Do this next</span>
          <h2 id="hero-title">
            <button type="button" className="plain" onClick={() => setSel(hero.id)}>{hero.short}</button>
          </h2>
          <p>{supportLine(hero.why)}</p>
          <div className="actions">
            <button type="button" className="btn primary" onClick={() => answer(hero.id, 'yes')}>Yes, done</button>
            <button type="button" className="btn outline" onClick={() => answer(hero.id, 'no')}>Not yet</button>
          </div>
        </section>
      ) : (
        <section className="card center">
          <span className="ico done"><Icon name="check" /></span>
          <h2>You're all caught up</h2>
          <p className="muted">Nothing to check right now. If something changes, tap “Something changed?”.</p>
        </section>
      )}

      {(deadline || pd || f1) && (
        <div className="tiles">
          {deadline && (
            <section className="tile" aria-label="Next deadline">
              <span className="label">Next deadline</span>
              <span className="big">{left(profile.dates[deadline.k], deadline.n, today)}</span>
              <span className="sub">{VISAS.fields[deadline.k].label} · {formatDate(profile.dates[deadline.k])}</span>
            </section>
          )}
          {pd && (
            <PDMeter
              bulletins={BULLETINS}
              raw={profile.dates.priorityDate}
              pd={dates.priorityDate}
              category={dates.ebCategory}
              onExactDay={(iso) => setDate('priorityDate', iso)}
            />
          )}
          {f1 && (
            <section className="tile" aria-label={f1.label}>
              <span className="label">{f1.label}</span>
              <span className="big">{f1.big}</span>
              <span className="sub">{f1.sub}</span>
            </section>
          )}
        </div>
      )}

      {rest.length > 0 && (
        <section className="section">
          <h2>Also to check</h2>
          <ul className="list">{rows(rest, false)}</ul>
        </section>
      )}

      {dayField ? (
        <section className="card" aria-label="Add the exact day">
          <p className="muted">Your {VISAS.fields[dayField].label} is this month. The exact day tells us whether it has passed.</p>
          <ExactDay month={profile.dates[dayField]} onSave={(iso) => setDate(dayField, iso)} onSkip={() => dismiss(`day:${dayField}`)} />
        </section>
      ) : prompt && <JitPrompt key={prompt} fieldId={prompt} onSave={(v) => setDate(prompt, v)} onDismiss={() => dismiss(prompt)} />}

      {done.length > 0 && (
        <ul className="list">
          <li>
            <button type="button" className="row kv" aria-expanded={showDone} onClick={() => setShowDone((v) => !v)}>
              <span className="row-text">Done · {done.length}</span>
              <span className="chev"><Icon name={showDone ? 'chevron-down' : 'chevron-right'} size={18} /></span>
            </button>
          </li>
          {showDone && rows(done, true)}
        </ul>
      )}

      {selected && (
        <CheckSheet
          check={selected}
          state={profile.checks[selected.id]}
          done={done.some((c) => c.id === selected.id)}
          onAnswer={answer}
          onClose={() => setSel(null)}
          extra={
            selected.input === 'priorityDay' && /^\d{4}-\d{2}$/.test(profile.dates.priorityDate ?? '') ? (
              <ExactDay month={profile.dates.priorityDate} onSave={(iso) => { setDate('priorityDate', iso); setSel(null); }} />
            ) : null
          }
        />
      )}

      {changing && (
        <Sheet title="What changed?" onClose={() => setChanging(false)}>
          <p className="sheet-hint">Pick what is going on and we will bring up the right checks.</p>
          <div className="chips">
            {situations.map((s) => {
              const on = profile.situations.includes(s.id);
              return (
                <button key={s.id} type="button" className="chip-btn" aria-pressed={on} onClick={() => toggle(s.id)}>
                  <span className="chip">{on && <Icon name="check" size={14} />}{s.label}</span>
                </button>
              );
            })}
          </div>
        </Sheet>
      )}
    </>
  );
}
