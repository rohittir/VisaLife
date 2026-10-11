import { useState } from 'react';
import { monthChoices, timingOf, yearChoices } from '../lib/dates.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const TIMING = [['past', 'Already passed'], ['ahead', 'Still ahead']];

// Month and year selects for a month-only field. Emits "YYYY-MM" once both are chosen, "" otherwise.
// Expiry-type fields (`deadline`) first ask whether the date has passed or is still ahead: that picks the
// direction of the year list and hides months that cannot be true, so there is little to scroll.
function MonthYear({ label, value, onChange, deadline }) {
  const now = new Date();
  const [y0 = '', m0 = ''] = (value ?? '').split('-');
  const [y, setY] = useState(y0);
  const [m, setM] = useState(m0);
  const [when, setWhen] = useState(deadline ? timingOf(value, now) : 'past');
  const years = yearChoices(when ?? 'ahead', now, deadline ? 10 : 25);
  if (y && !years.includes(Number(y))) years.push(Number(y));
  const months = monthChoices(when, y, now);

  const emit = (ny, nm) => {
    setY(ny);
    setM(nm);
    onChange(ny && nm ? `${ny}-${nm}` : '');
  };
  const pickYear = (ny) => emit(ny, m && monthChoices(when, ny, now).includes(Number(m)) ? m : '');
  const pickTiming = (w) => {
    setWhen(w);
    emit('', '');
  };

  return (
    <fieldset className="field">
      <legend>{label}</legend>
      {deadline && (
        <div className="seg" role="group" aria-label={`${label}: has it passed?`}>
          {TIMING.map(([k, t]) => (
            <button key={k} type="button" aria-pressed={when === k} onClick={() => pickTiming(k)}>{t}</button>
          ))}
        </div>
      )}
      {when && (
        <div className="pair">
          <select aria-label={`${label}, month`} value={m} onChange={(e) => emit(y, e.target.value)}>
            <option value="">Month</option>
            {months.map((n) => (
              <option key={n} value={String(n).padStart(2, '0')}>{MONTHS[n - 1]}</option>
            ))}
          </select>
          <select aria-label={`${label}, year`} value={y} onChange={(e) => pickYear(e.target.value)}>
            <option value="">Year</option>
            {years.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      )}
    </fieldset>
  );
}

// One control for any visas.json field: month and year (precision "month"), a date, a select or a number.
// `value` is the stored string ("YYYY-MM", "YYYY-MM-DD", "EB2", ...); onChange gets the new string ("" when cleared).
export default function FieldInput({ field, value, onChange, label = field.label, hideLabel = false }) {
  if (field.type === 'date' && field.precision === 'month') {
    return <MonthYear label={label} value={value} onChange={onChange} deadline={Boolean(field.deadline)} />;
  }
  return (
    <label className="field">
      <span className={hideLabel ? 'sr-only' : undefined}>{label}</span>
      {field.type === 'select' ? (
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select</option>
          {field.options.map((o) => (
            <option key={o} value={o}>{o.replace('EB', 'EB-')}</option>
          ))}
        </select>
      ) : (
        <input
          type={field.type === 'number' ? 'number' : 'date'}
          inputMode={field.type === 'number' ? 'numeric' : undefined}
          min={field.type === 'number' ? 0 : undefined}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
