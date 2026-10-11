import { formatDate } from '../lib/dates.js';
import { estimate, history, movement, status } from '../lib/bulletin.js';
import Sparkline from './Sparkline.jsx';

const CHARTS = { finalAction: 'Final Action Dates', datesForFiling: 'Dates for Filing' };
const cut = (c) => (c === 'C' ? 'Current' : c === 'U' ? 'Unavailable' : formatDate(c));
const monthName = (m) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

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
  const n = years > 50 ? 'more than 50 years' : years < 1 ? 'under a year' : `${Math.round(years)} year${Math.round(years) === 1 ? '' : 's'}`;
  return `Roughly ${n} at the last 12 months' pace, not a prediction.`;
}

function Row({ name, value, state }) {
  return (
    <div className="pd-row">
      <dt>{name}</dt>
      <dd>
        {value}
        {state && <span className={state === 'current' ? 'pill on' : 'pill'}>{state === 'current' ? '✓ Current' : 'Not current'}</span>}
      </dd>
    </div>
  );
}

export default function PDMeter({ bulletins, pd, category }) {
  const s = status(bulletins, pd, category);
  if (!s) return null;
  const name = category.replace('EB', 'EB-');
  return (
    <section className="card pd">
      <span className="eyebrow">Priority date · {name} India</span>
      <dl>
        <Row name="Your priority date" value={formatDate(pd)} />
        <Row name="Final Action" value={cut(s.cutoffs.finalAction)} state={s.finalAction} />
        <Row name="Dates for Filing" value={cut(s.cutoffs.datesForFiling)} state={s.datesForFiling} />
      </dl>
      <p className="small muted">
        {monthName(s.month)} Visa Bulletin. USCIS accepted the {CHARTS[s.chartUsedByUscis]} chart for I-485 filing that month.
      </p>
      <p className="small">{moved(movement(bulletins, category, 1)[0], s.cutoffs.finalAction)}</p>
      <Sparkline points={history(bulletins, category)} label="Final Action cut-off" />
      <p className="small">{pace(estimate(bulletins, pd, category), s)}</p>
    </section>
  );
}
