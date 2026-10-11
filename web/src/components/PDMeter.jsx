import { useState } from 'react';
import { formatDate, isMonth, monthEnd } from '../lib/dates.js';
import { ambiguity, estimate, gap, history, latest, movement, progress, status } from '../lib/bulletin.js';
import Icon from './Icon.jsx';
import Sheet from './Sheet.jsx';
import Sparkline from './Sparkline.jsx';

const CHARTS = { finalAction: 'Final Action Dates', datesForFiling: 'Dates for Filing' };
const cut = (c) => (c === 'C' ? 'Current' : c === 'U' ? 'Unavailable' : formatDate(c));
const monthName = (m) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const unit = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function moved(days, c) {
  if (c === 'U') return 'Final Action is unavailable this month: no green cards in this category until it reopens.';
  if (c === 'C') return 'Final Action is current this month.';
  if (days == null) return 'Final Action reopened this month, so there is no movement to compare.';
  if (days === 0) return 'Final Action did not move this month.';
  return days > 0 ? `Final Action moved ahead ${days} days this month.` : `Final Action moved back ${-days} days this month.`;
}

function pace(years, s) {
  if (s.finalAction === 'current') return 'Your date is current for final action.';
  if (years == null) return 'No forward movement in the last 12 months, so no estimate.';
  if (years === 0) return 'Your date is before the last cut-off; you are waiting for the category to reopen.';
  const n = years > 50 ? 'more than 50 years' : years < 1 ? 'under a year' : unit(Math.round(years), 'year');
  return `Roughly ${n} at the last 12 months' pace, not a prediction.`;
}

function gapText(g) {
  if (!g) return null;
  if (g.same) return 'Cut-off is in the same month as your date.';
  const span = [g.years && unit(g.years, 'year'), g.months && unit(g.months, 'month')].filter(Boolean).join(' ');
  return `Cut-off is ${span} ${g.behind ? 'behind' : 'ahead of'} your date.`;
}

// One field: the day inside `month` ("YYYY-MM"). Saving turns the month-only date into an exact one.
export function ExactDay({ month, onSave }) {
  const [v, setV] = useState('');
  return (
    <form className="exact" onSubmit={(e) => { e.preventDefault(); if (v) onSave(v); }}>
      <label className="field">
        <span>Add the exact day</span>
        <input type="date" value={v} min={`${month}-01`} max={monthEnd(month)} onChange={(e) => setV(e.target.value)} />
      </label>
      <button className="btn solid" disabled={!v}>Save day</button>
    </form>
  );
}

// Home tile for the priority date, and the detail sheet it opens.
// raw = the value as entered ("YYYY-MM" or a full date); pd = the resolved full date; onExactDay(iso) stores a day.
export default function PDMeter({ bulletins, raw, pd, category, onExactDay }) {
  const [open, setOpen] = useState(false);
  const s = status(bulletins, pd, category);
  if (!s) return null;
  const name = category.replace('EB', 'EB-');
  const uscis = s.chartUsedByUscis;
  const dayDecides = isMonth(raw) && ambiguity(bulletins, raw, category)?.[uscis];

  if (dayDecides) {
    return (
      <section className="tile wide">
        <span className="label">Priority date · {name} India</span>
        <span className="big">{formatDate(raw)}</span>
        <p>
          The {CHARTS[uscis]} cut-off falls in {formatDate(raw)}, so the exact day decides whether your date is current.
        </p>
        <ExactDay month={raw} onSave={onExactDay} />
      </section>
    );
  }

  const current = s[uscis] === 'current';
  const p = progress(bulletins, pd, category);
  const row = (chart) => {
    const g = gapText(gap(bulletins, pd, category, chart));
    return (
      <div className="pd-row" key={chart}>
        <div>
          <dt>{CHARTS[chart]}</dt>
          <dd>
            {cut(s.cutoffs[chart])} <span className="sr-only">{s[chart]}</span>
          </dd>
        </div>
        <span className={`status${s[chart] === 'current' ? ' good' : ''}`}>
          {s[chart] === 'current' && <Icon name="check" size={14} />}
          {s[chart] === 'current' ? 'Current' : 'Not current'}
        </span>
        {g && <dd className="sub">{g}</dd>}
      </div>
    );
  };
  const dated = history(bulletins, category).filter((x) => /^\d{4}-/.test(x.cutoff));

  return (
    <>
      <button type="button" className="tile" onClick={() => setOpen(true)}>
        <span className="label">Priority date · {name}</span>
        <span className="big">{formatDate(raw)}</span>
        {p != null && (
          <span className="bar" role="img" aria-label="Progress of the Final Action cut-off toward your date over the last 12 months">
            <i style={{ width: `${Math.round(p * 100)}%` }} />
          </span>
        )}
        <span className={`status${current ? ' good' : ''}`}>
          {current && <Icon name="check" size={14} />}
          {current ? 'Current for filing' : 'Not current yet'}
        </span>
      </button>
      {open && (
        <Sheet title="Your priority date" eyebrow={<span className="chip">{name} India · {monthName(s.month)} bulletin</span>} onClose={() => setOpen(false)}>
          <div className="stack">
            <p className="big-title">{formatDate(raw)}</p>
            {isMonth(raw) && <p className="label">Month only. We use the last day of the month, so this never says more than you know.</p>}
          </div>
          <dl className="pd">
            {row('finalAction')}
            {row('datesForFiling')}
          </dl>
          <p>USCIS accepted the {CHARTS[uscis]} chart for filing that month.</p>
          <p>{moved(movement(bulletins, category, 1)[0], s.cutoffs.finalAction)}</p>
          {dated.length > 1 && (
            <p className="label">
              Over the last 12 bulletins the Final Action cut-off moved from {formatDate(dated[0].cutoff)} to {formatDate(dated.at(-1).cutoff)} (its latest dated value).
            </p>
          )}
          <Sparkline points={history(bulletins, category)} label="Final Action cut-off" />
          <p>{pace(estimate(bulletins, pd, category), s)}</p>
          <ul className="link-list">
            <li>
              <a href={latest(bulletins).source} target="_blank" rel="noopener noreferrer">
                <span>Visa Bulletin (State Dept)</span>
                <Icon name="external-link" size={18} />
              </a>
            </li>
          </ul>
        </Sheet>
      )}
    </>
  );
}
