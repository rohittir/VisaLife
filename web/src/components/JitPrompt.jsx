import { useState } from 'react';
import { VISAS } from '../lib/content.js';
import FieldInput from './FieldInput.jsx';

// The first date of this stage that is still missing, has a reason to ask (`unlock` in visas.json) and was not dismissed.
export const nextPrompt = (stage, profile) =>
  stage?.fields.find((k) => VISAS.fields[k].unlock && !profile.dates[k] && !profile.dismissed?.includes(k));

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
