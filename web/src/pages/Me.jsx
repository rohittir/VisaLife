import { useNavigate } from 'react-router-dom';
import { useProfile } from '../lib/profile.jsx';
import { VISAS } from '../lib/content.js';
import ProfileForm from '../components/ProfileForm.jsx';

export default function Me() {
  const { profile, update, reset } = useProfile();
  const nav = useNavigate();
  const stages = VISAS.visas[profile.visa].stages;

  const wipe = () => {
    if (!window.confirm('Delete everything VisaLife stored in this browser?')) return;
    reset();
    nav('/start', { replace: true });
  };

  return (
    <>
      <h1>Me</h1>
      <section className="card">
        <label className="field">
          <span>Visa</span>
          <select value={profile.visa} onChange={(e) => update({ visa: e.target.value, stage: VISAS.visas[e.target.value].stages[0].id })}>
            {Object.entries(VISAS.visas).map(([id, v]) => (
              <option key={id} value={id}>{v.label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Stage</span>
          <select value={profile.stage} onChange={(e) => update({ stage: e.target.value })}>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </label>
        <ProfileForm visa={profile.visa} stage={profile.stage} dates={profile.dates} flags={profile.flags} onChange={(f) => update(f)} />
      </section>

      <section className="card">
        <h2>Sync across devices</h2>
        <p className="muted">Sign-in with Google or an email code is the next release. Until then your profile lives only in this browser.</p>
      </section>

      <section className="card">
        <h2>Your data</h2>
        <p className="muted">Nothing is sent anywhere. Dates and answers are stored in this browser only.</p>
        <button className="ghost danger" onClick={wipe}>Delete my data</button>
      </section>

      <p className="muted small">VisaLife summarises information published by USCIS, CBP, DHS, the Department of State and the Department of Labor. It is not legal advice.</p>
    </>
  );
}
