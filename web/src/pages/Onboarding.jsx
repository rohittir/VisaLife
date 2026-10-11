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
  // Always starts on the first page. With a saved profile (Me > Change) it marks the current choice and prefills the dates.
  const editing = Boolean(profile?.visa && profile?.stage);
  const [visa, setVisa] = useState(null);
  const [stage, setStage] = useState(null);
  const [dates, setDates] = useState(profile?.dates ?? {});
  const quick = stageOf(visa, stage)?.quick ?? [];
  const noun = quick.every((k) => VISAS.fields[k].type === 'date') ? 'date' : 'question'; // a quick field can be a select
  const step = !visa ? 0 : !stage ? 1 : 2;

  // Quick fields left empty count as skipped: Today must not ask for the same date straight away.
  const finish = (d, s = stage) => {
    const skipped = stageOf(visa, s).quick.filter((k) => !d[k]);
    update({ visa, stage: s, dates: { ...(profile?.dates ?? {}), ...d }, dismissed: [...new Set([...(profile?.dismissed ?? []), ...skipped])] });
    nav('/home', { replace: true });
  };
  // A stage with nothing to ask goes straight to Today.
  const pickStage = (s) => (stageOf(visa, s).quick.length ? setStage(s) : finish({}, s));
  const entered = Object.fromEntries(quick.filter((k) => dates[k]).map((k) => [k, dates[k]]));

  return (
    <div className="app">
      <main className="screen onboarding">
        <header className="brand">
          <span className="mark">
            <img src="/icon-192.png" alt="" width="40" height="40" />
            <span>
              <strong>VisaLife</strong>
              <small>by WorkingAlien</small>
            </span>
          </span>
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
                <button key={id} type="button" className="choice" aria-current={editing && id === profile.visa ? 'true' : undefined} onClick={() => setVisa(id)}>
                  <span className="ico"><Icon name={VISA_ICON[id]} size={24} /></span>
                  <span>
                    <strong>{v.label}</strong>
                    {editing && id === profile.visa && <small>Current</small>}
                  </span>
                  <Icon name="chevron-right" />
                </button>
              ))}
            </div>
            {editing && <button type="button" className="btn-text start" onClick={() => nav('/me', { replace: true })}>Cancel</button>}
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="big-title">Where are you right now?</h1>
            <div className="choices">
              {VISAS.visas[visa].stages.map((s) => {
                const current = editing && visa === profile.visa && s.id === profile.stage;
                return (
                  <button key={s.id} type="button" className="choice" aria-current={current ? 'true' : undefined} onClick={() => pickStage(s.id)}>
                    <span>
                      <strong>{s.label}</strong>
                      <small>{current ? `Current · ${s.hint}` : s.hint}</small>
                    </span>
                    <Icon name="chevron-right" />
                  </button>
                );
              })}
            </div>
            <button type="button" className="btn-text start" onClick={() => setVisa(null)}>Back</button>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="big-title">{quick.length > 1 ? `Two quick ${noun}s` : `One quick ${noun}`}</h1>
            <p className="muted">Each answer turns on a countdown or a check. Your answers stay on this device.</p>
            <div className="form">
              {quick.map((k) => (
                <FieldInput key={k} field={VISAS.fields[k]} value={dates[k]} onChange={(v) => setDates((d) => ({ ...d, [k]: v }))} />
              ))}
              <p className="label">Optional. You can skip this.</p>
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
