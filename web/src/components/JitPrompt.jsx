import { useState } from 'react';
import { VISAS } from '../lib/content.js';
import { nextPrompt as pick } from '../lib/prompts.js';
import FieldInput from './FieldInput.jsx';

// The next date or choice to ask on Today (rules in lib/prompts.js).
export const nextPrompt = (stage, profile, today) => pick(stage, profile, VISAS.fields, today);

// One quiet card: why it helps, one field, Save, and Skip, which is remembered in the profile.
export default function JitPrompt({ fieldId, onSave, onDismiss }) {
  const f = VISAS.fields[fieldId];
  const [v, setV] = useState('');
  return (
    <section className="card" aria-label="Add a date">
      <p className="muted">{f.unlock}</p>
      <FieldInput field={f} value={v} onChange={setV} label={f.label} />
      <div className="actions">
        <button type="button" className="btn solid" disabled={!v} onClick={() => onSave(v)}>Save</button>
        <button type="button" className="btn outline" onClick={onDismiss}>Skip</button>
      </div>
    </section>
  );
}
