import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../lib/profile.jsx';
import { VISAS, stageOf } from '../lib/content.js';
import { formatDate } from '../lib/dates.js';
import { GROUPS } from '../lib/visas.js';
import FieldInput from '../components/FieldInput.jsx';
import Icon from '../components/Icon.jsx';
import Sheet from '../components/Sheet.jsx';

const show = (f, v) => (f.type === 'select' ? v.replace('EB', 'EB-') : formatDate(v));

function EditDate({ id, value, onSave, onClose }) {
  const f = VISAS.fields[id];
  const [v, setV] = useState(value ?? '');
  return (
    <Sheet title={f.label} onClose={onClose}>
      <FieldInput field={f} value={v} onChange={setV} label={f.type === 'date' && f.precision === 'month' ? 'Month and year' : f.label} />
      <div className="actions">
        <button type="button" className="btn primary" disabled={!v} onClick={() => onSave(v)}>Save</button>
        <button type="button" className="btn outline" disabled={!value} onClick={() => onSave('')}>Clear</button>
      </div>
    </Sheet>
  );
}

function EditProfile({ profile, update, onClose }) {
  return (
    <Sheet title="Visa and stage" onClose={onClose}>
      <div className="form">
        <label className="field">
          <span>Visa</span>
          <select value={profile.visa} onChange={(e) => update({ visa: e.target.value, stage: VISAS.visas[e.target.value].stages[0].id })}>
            {Object.entries(VISAS.visas).map(([id, v]) => <option key={id} value={id}>{v.label}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Stage</span>
          <select value={profile.stage} onChange={(e) => update({ stage: e.target.value })}>
            {VISAS.visas[profile.visa].stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
      </div>
    </Sheet>
  );
}

export default function Me() {
  const { profile, update, reset } = useProfile();
  const nav = useNavigate();
  const [edit, setEdit] = useState(null); // 'profile' or a field id
  const stage = stageOf(profile.visa, profile.stage);
  const dateFields = stage.fields.filter((k) => VISAS.fields[k].type !== 'number');
  const numbers = stage.fields.filter((k) => VISAS.fields[k].type === 'number');
  const flags = VISAS.flags.filter((f) => f.visas.includes(profile.visa));
  const setDate = (k, v) => update((p) => ({ dates: { ...p.dates, [k]: v === '' || v == null ? undefined : v } }));
  const setFlag = (k, v) => update((p) => ({ flags: { ...p.flags, [k]: v } }));

  const wipe = () => {
    if (!window.confirm('Delete everything VisaLife stored in this browser?')) return;
    reset();
    nav('/start', { replace: true });
  };

  return (
    <>
      <h1>Me</h1>

      <section className="card">
        <div className="top">
          <div>
            <p><strong>{VISAS.visas[profile.visa].label}</strong></p>
            <p className="muted">{stage.label}</p>
          </div>
          <button type="button" className="btn quiet" onClick={() => setEdit('profile')}>Change</button>
        </div>
      </section>

      <section className="section">
        <h2>Your dates</h2>
        <p className="label">All optional. Add them when you have them: each one turns on a countdown or a check.</p>
        {GROUPS.map((g) => {
          const ks = dateFields.filter((k) => VISAS.fields[k].group === g);
          if (!ks.length) return null;
          return (
            <div key={g} className="section">
              <p className="label">{g}</p>
              <ul className="list">
                {ks.map((k) => {
                  const f = VISAS.fields[k];
                  const v = profile.dates[k];
                  return (
                    <li key={k}>
                      <button type="button" className="row kv" onClick={() => setEdit(k)}>
                        <span className="row-text">{f.label}</span>
                        <span className={`value${v ? ' set' : ''}`}>{v ? show(f, v) : 'Add'}</span>
                        <span className="chev"><Icon name="chevron-right" size={18} /></span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {(numbers.length > 0 || flags.length > 0) && (
          <details className="adv">
            <summary>
              Advanced
              <Icon name="chevron-down" size={18} />
            </summary>
            <div className="form">
              {numbers.map((k) => (
                <FieldInput key={k} field={VISAS.fields[k]} value={profile.dates[k] ?? ''} onChange={(v) => setDate(k, v === '' ? undefined : Number(v))} />
              ))}
              {flags.map((f) =>
                f.type === 'boolean' ? (
                  <label key={f.id} className="field check">
                    <input type="checkbox" checked={!!profile.flags[f.id]} onChange={(e) => setFlag(f.id, e.target.checked)} />
                    <span>{f.label}</span>
                  </label>
                ) : (
                  <label key={f.id} className="field">
                    <span>{f.label}</span>
                    <input type="number" inputMode="numeric" value={profile.flags[f.id] ?? ''} onChange={(e) => setFlag(f.id, e.target.value ? Number(e.target.value) : undefined)} />
                  </label>
                ),
              )}
            </div>
          </details>
        )}
      </section>

      <section className="card">
        <h2>Sync across devices</h2>
        <p className="muted">Sign-in with Google or an email code is the next release. Until then your profile lives only in this browser.</p>
      </section>

      <section className="card">
        <h2>Your data</h2>
        <p className="muted">Nothing is sent anywhere. Dates and answers are stored in this browser only.</p>
        <button type="button" className="btn danger" onClick={wipe}>Delete my data</button>
      </section>

      <section className="card">
        <h2>About</h2>
        <p className="muted">VisaLife summarises information published by USCIS, CBP, DHS, the Department of State and the Department of Labor. It is not legal advice.</p>
      </section>

      {edit === 'profile' && <EditProfile profile={profile} update={update} onClose={() => setEdit(null)} />}
      {edit && edit !== 'profile' && (
        <EditDate key={edit} id={edit} value={profile.dates[edit]} onClose={() => setEdit(null)} onSave={(v) => { setDate(edit, v); setEdit(null); }} />
      )}
    </>
  );
}
