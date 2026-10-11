import { useState } from 'react';
import { VISAS } from '../lib/content.js';
import FieldInput from './FieldInput.jsx';
import Icon from './Icon.jsx';

// The first date of this stage that is still missing, has a reason to ask (`unlock` in visas.json) and was not dismissed.
export const nextPrompt = (stage, profile) =>
  stage?.fields.find((k) => VISAS.fields[k].unlock && !profile.dates[k] && !profile.dismissed?.includes(k));

// One quiet row: why it helps, one field, Save, and a dismiss that is remembered in the profile.
export default function JitPrompt({ fieldId, onSave, onDismiss }) {
  const f = VISAS.fields[fieldId];
  const [v, setV] = useState('');
  return (
    <section className="card" aria-label="Add a date">
      <div className="top">
        <p className="muted">{f.unlock}</p>
        <button type="button" className="sheet-close" aria-label="Not now" onClick={onDismiss}>
          <Icon name="x" />
        </button>
      </div>
      <FieldInput field={f} value={v} onChange={setV} label={f.label} />
      <button type="button" className="btn solid" disabled={!v} onClick={() => onSave(v)}>Save</button>
    </section>
  );
}
