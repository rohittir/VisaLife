import { useState } from 'react';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Month and year selects for a month-only field. Emits "YYYY-MM" once both are chosen, "" otherwise.
function MonthYear({ label, value, onChange, future }) {
  const [y0 = '', m0 = ''] = (value ?? '').split('-');
  const [y, setY] = useState(y0);
  const [m, setM] = useState(m0);
  const now = new Date().getFullYear();
  const years = Array.from({ length: future ? 13 : 26 }, (_, i) => (future ? now - 1 + i : now - i));
  if (y && !years.includes(Number(y))) years.push(Number(y));
  const set = (ny, nm) => {
    setY(ny);
    setM(nm);
    onChange(ny && nm ? `${ny}-${nm}` : '');
  };
  return (
    <fieldset className="field">
      <legend>{label}</legend>
      <div className="pair">
        <select aria-label={`${label}, month`} value={m} onChange={(e) => set(y, e.target.value)}>
          <option value="">Month</option>
          {MONTHS.map((n, i) => (
            <option key={n} value={String(i + 1).padStart(2, '0')}>{n}</option>
          ))}
        </select>
        <select aria-label={`${label}, year`} value={y} onChange={(e) => set(e.target.value, m)}>
          <option value="">Year</option>
          {years.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
    </fieldset>
  );
}

// One control for any visas.json field: month and year (precision "month"), a date, a select or a number.
// `value` is the stored string ("YYYY-MM", "YYYY-MM-DD", "EB2", ...); onChange gets the new string ("" when cleared).
export default function FieldInput({ field, value, onChange, label = field.label, hideLabel = false }) {
  if (field.type === 'date' && field.precision === 'month') {
    return <MonthYear label={label} value={value} onChange={onChange} future={Boolean(field.deadline)} />;
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
