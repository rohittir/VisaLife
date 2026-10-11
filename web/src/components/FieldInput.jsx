import { useId, useState } from 'react';
import { PASSED, monthChoices, timingOf, yearChoices } from '../lib/dates.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ROWS = [['ahead', 'Still ahead', 'Pick the month and year'], ['past', 'Already passed', 'No date needed']];

// Month and year selects for a month-only field. Emits "YYYY-MM" once both are chosen, "" otherwise.
// Expiry-type fields (`deadline`) first ask whether the date is still ahead or already passed, as two radio rows with the
// selects under the chosen one. "Already passed" is a complete answer (PASSED); the month and year after it are optional.
// A `timing: "ahead"` field skips that question and shows only the selects.
function MonthYear({ question, value, onChange, deadline, ahead }) {
  const now = new Date();
  const name = useId();
  const [y0 = '', m0 = ''] = value === PASSED ? [] : (value ?? '').split('-');
  const [y, setY] = useState(y0);
  const [m, setM] = useState(m0);
  const asks = deadline && !ahead;
  const [choice, setChoice] = useState(timingOf(value, now));
  const when = asks ? choice ?? 'ahead' : ahead ? 'ahead' : 'past';
  const years = yearChoices(when, now, deadline ? 10 : 25);
  if (y && !years.includes(Number(y))) years.push(Number(y));
  const months = monthChoices(when, y, now);

  const emit = (ny, nm, c = choice) => {
    setY(ny);
    setM(nm);
    onChange(ny && nm ? `${ny}-${nm}` : asks && c === 'past' ? PASSED : '');
  };
  const pickYear = (ny) => emit(ny, m && monthChoices(when, ny, now).includes(Number(m)) ? m : '');
  const pick = (c) => {
    setChoice(c);
    emit('', '', c);
  };

  const pickers = (optional) => (
    <>
      {optional && <p className="label">Optional. Add the month and year if you know them.</p>}
      <div className="pair">
        <select aria-label="Month" value={m} onChange={(e) => emit(y, e.target.value)}>
          <option value="">Month</option>
          {months.map((n) => (
            <option key={n} value={String(n).padStart(2, '0')}>{MONTHS[n - 1]}</option>
          ))}
        </select>
        <select aria-label="Year" value={y} onChange={(e) => pickYear(e.target.value)}>
          <option value="">Year</option>
          {years.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
    </>
  );

  return (
    <fieldset className={`field${deadline ? ' ask' : ''}`}>
      <legend>{question}</legend>
      {asks ? (
        <div className="radios">
          {ROWS.map(([k, title, sub]) => (
            <div key={k} className="radio-set">
              <label className={`radio${choice === k ? ' on' : ''}`}>
                <input type="radio" name={name} value={k} checked={choice === k} onChange={() => pick(k)} />
                <span>
                  <strong>{title}</strong>
                  <small>{sub}</small>
                </span>
              </label>
              {choice === k && pickers(k === 'past')}
            </div>
          ))}
        </div>
      ) : (
        pickers(false)
      )}
    </fieldset>
  );
}

// One control for any visas.json field: month and year (precision "month"), a date, a select or a number.
// `value` is the stored string ("YYYY-MM", "YYYY-MM-DD", "EB2", ...); onChange gets the new string ("" when cleared).
export default function FieldInput({ field, value, onChange, label = field.question ?? field.label, hideLabel = false }) {
  if (field.type === 'date' && field.precision === 'month') {
    return <MonthYear question={field.question ?? label} value={value} onChange={onChange} deadline={Boolean(field.deadline)} ahead={field.timing === 'ahead'} />;
  }
  return (
    <label className={`field${field.question ? ' ask' : ''}`}>
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
