import { useState } from 'react';
import { VISAS, stageOf } from '../lib/content.js';

// Renders the date fields for a visa + stage, plus that visa's flags. `collapsed` shows four fields first.
export default function ProfileForm({ visa, stage, dates, flags, onChange, collapsed = false }) {
  const [more, setMore] = useState(!collapsed);
  const fields = stageOf(visa, stage)?.fields ?? [];
  const shown = more ? fields : fields.slice(0, 4);
  const setDate = (k, v) => onChange({ dates: { ...dates, [k]: v || undefined }, flags });
  const setFlag = (k, v) => onChange({ dates, flags: { ...flags, [k]: v } });

  return (
    <div className="form">
      {shown.map((k) => {
        const f = VISAS.fields[k];
        return (
          <label key={k} className="field">
            <span>{f.label}</span>
            {f.type === 'select' ? (
              <select value={dates[k] ?? ''} onChange={(e) => setDate(k, e.target.value)}>
                <option value="">Not sure</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>{o.replace('EB', 'EB-')}</option>
                ))}
              </select>
            ) : (
              <input
                type={f.type}
                inputMode={f.type === 'number' ? 'numeric' : undefined}
                min={f.type === 'number' ? 0 : undefined}
                value={dates[k] ?? ''}
                onChange={(e) => setDate(k, e.target.value)}
              />
            )}
          </label>
        );
      })}
      {!more && fields.length > 4 && (
        <button type="button" className="link" onClick={() => setMore(true)}>
          More dates ({fields.length - 4})
        </button>
      )}
      {VISAS.flags
        .filter((f) => f.visas.includes(visa))
        .map((f) =>
          f.type === 'boolean' ? (
            <label key={f.id} className="field row">
              <input type="checkbox" checked={!!flags[f.id]} onChange={(e) => setFlag(f.id, e.target.checked)} />
              <span>{f.label}</span>
            </label>
          ) : (
            <label key={f.id} className="field">
              <span>{f.label}</span>
              <input
                type="number"
                inputMode="numeric"
                value={flags[f.id] ?? ''}
                onChange={(e) => setFlag(f.id, e.target.value ? Number(e.target.value) : undefined)}
              />
            </label>
          ),
        )}
    </div>
  );
}
