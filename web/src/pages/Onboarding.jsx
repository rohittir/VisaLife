import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../lib/profile.jsx';
import { VISAS } from '../lib/content.js';
import ProfileForm from '../components/ProfileForm.jsx';

export default function Onboarding() {
  const { profile, update } = useProfile();
  const nav = useNavigate();
  const [visa, setVisa] = useState(profile?.visa ?? null);
  const [stage, setStage] = useState(profile?.stage ?? null);
  const [form, setForm] = useState({ dates: profile?.dates ?? {}, flags: profile?.flags ?? {} });
  const step = !visa ? 0 : !stage ? 1 : 2;

  const finish = () => {
    update({ visa, stage, dates: form.dates, flags: form.flags });
    nav('/home', { replace: true });
  };

  return (
    <div className="app">
      <main className="screen onboarding">
        <header className="brand">
          <h1>VisaLife</h1>
          <p>The few things to check for your US visa, right now. Free, no account needed.</p>
        </header>
        <p className="eyebrow">Step {step + 1} of 3</p>

        {step === 0 && (
          <>
            <h2>I'm in the US on…</h2>
            <div className="choices">
              {Object.entries(VISAS.visas).map(([id, v]) => (
                <button key={id} className="choice" onClick={() => setVisa(id)}>
                  <strong>{v.label}</strong>
                </button>
              ))}
            </div>
            <p className="muted">Phase 1 covers Indian nationals already in the US.</p>
          </>
        )}

        {step === 1 && (
          <>
            <h2>Where are you right now?</h2>
            <div className="choices">
              {VISAS.visas[visa].stages.map((s) => (
                <button key={s.id} className="choice" onClick={() => setStage(s.id)}>
                  <strong>{s.label}</strong>
                  <small>{s.hint}</small>
                </button>
              ))}
            </div>
            <button className="link" onClick={() => setVisa(null)}>Back</button>
          </>
        )}

        {step === 2 && (
          <>
            <h2>Key dates</h2>
            <p className="muted">All optional. Each one becomes a countdown and a timely check. Nothing leaves this device.</p>
            <ProfileForm visa={visa} stage={stage} dates={form.dates} flags={form.flags} onChange={setForm} collapsed />
            <button className="primary wide" onClick={finish}>Show my checks</button>
            <button className="link" onClick={() => setStage(null)}>Back</button>
          </>
        )}
      </main>
    </div>
  );
}
