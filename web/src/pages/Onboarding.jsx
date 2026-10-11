import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../lib/profile.jsx';
import { VISAS, stageOf } from '../lib/content.js';
import FieldInput from '../components/FieldInput.jsx';
import Icon from '../components/Icon.jsx';

const VISA_ICON = { H1B: 'id-card', H4: 'user', F1: 'route' };

export default function Onboarding() {
  const { profile, update } = useProfile();
  const nav = useNavigate();
  const [visa, setVisa] = useState(profile?.visa ?? null);
  const [stage, setStage] = useState(profile?.stage ?? null);
  const [dates, setDates] = useState({});
  const quick = stageOf(visa, stage)?.quick ?? [];
  const step = !visa ? 0 : !stage ? 1 : 2;

  const finish = (d, s = stage) => {
    update({ visa, stage: s, dates: { ...(profile?.dates ?? {}), ...d } });
    nav('/home', { replace: true });
  };
  // A stage with nothing to ask goes straight to Today.
  const pickStage = (s) => (stageOf(visa, s).quick.length ? setStage(s) : finish({}, s));
  const entered = Object.fromEntries(Object.entries(dates).filter(([, v]) => v));

  return (
    <div className="app">
      <main className="screen onboarding">
        <header className="brand">
          <strong>VisaLife</strong>
          <span className="dots" role="img" aria-label={`Step ${step + 1} of 3`}>
            {[0, 1, 2].map((i) => <i key={i} className={i === step ? 'on' : ''} />)}
          </span>
        </header>

        {step === 0 && (
          <>
            <h1 className="big-title">What visa are you on?</h1>
            <p className="muted">Free, no account. For Indian nationals already in the US.</p>
            <div className="choices">
              {Object.entries(VISAS.visas).map(([id, v]) => (
                <button key={id} type="button" className="choice" onClick={() => setVisa(id)}>
                  <span className="ico"><Icon name={VISA_ICON[id]} size={24} /></span>
                  <span><strong>{v.label}</strong></span>
                  <Icon name="chevron-right" />
                </button>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="big-title">Where are you right now?</h1>
            <div className="choices">
              {VISAS.visas[visa].stages.map((s) => (
                <button key={s.id} type="button" className="choice" onClick={() => pickStage(s.id)}>
                  <span>
                    <strong>{s.label}</strong>
                    <small>{s.hint}</small>
                  </span>
                  <Icon name="chevron-right" />
                </button>
              ))}
            </div>
            <button type="button" className="btn-text start" onClick={() => setVisa(null)}>Back</button>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="big-title">{quick.length > 1 ? 'Two quick dates' : 'One quick date'}</h1>
            <p className="muted">Only if you have them handy. Each one starts a countdown. Nothing leaves this device.</p>
            <div className="form">
              {quick.map((k) => (
                <FieldInput key={k} field={VISAS.fields[k]} value={dates[k]} onChange={(v) => setDates((d) => ({ ...d, [k]: v }))} />
              ))}
            </div>
            <div className="actions stacked">
              <button type="button" className="btn primary wide" onClick={() => finish(entered)}>Show my checks</button>
              <button type="button" className="btn outline wide" onClick={() => finish({})}>Skip for now</button>
            </div>
            <button type="button" className="btn-text start" onClick={() => setStage(null)}>Back</button>
          </>
        )}
      </main>
    </div>
  );
}
