import { formatDate } from '../lib/dates.js';

const month = (m) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

// Line of cut-off dates over months; "C"/"U" months leave a gap. points = [{ month, cutoff }], oldest first.
export default function Sparkline({ points, label, width = 300, height = 56 }) {
  const t = points.map((p) => (/^\d{4}-/.test(p.cutoff) ? Date.parse(p.cutoff) : null));
  const known = t.filter((v) => v != null);
  if (known.length < 2) return null;
  const lo = Math.min(...known);
  const hi = Math.max(...known);
  const x = (i) => 5 + (i * (width - 10)) / (points.length - 1);
  const y = (v) => height - 5 - ((v - lo) / (hi - lo || 1)) * (height - 10);
  const d = t.map((v, i) => (v == null ? '' : `${t[i - 1] == null ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)).join('');
  const first = points[0].month;
  const last = points.at(-1).month;
  return (
    <figure className="spark">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}, ${month(first)} to ${month(last)}`}>
        <path d={d} fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {t.map((v, i) =>
          v == null ? null : (
            <circle key={points[i].month} cx={x(i)} cy={y(v)} r="3" fill="var(--ink)">
              <title>{`${month(points[i].month)}: ${formatDate(points[i].cutoff)}`}</title>
            </circle>
          ),
        )}
      </svg>
      <figcaption>
        <span>{month(first)}</span>
        <span>{label}</span>
        <span>{month(last)}</span>
      </figcaption>
    </figure>
  );
}
