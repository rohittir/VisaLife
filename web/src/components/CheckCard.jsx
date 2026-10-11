export default function CheckCard({ check, state, onAnswer, done = false }) {
  const no = state?.answer === 'no';
  return (
    <article className={`card check${done ? ' done' : ''}${no ? ' no' : ''}`}>
      <span className="eyebrow">{check.title}</span>
      <h3>{check.ask}</h3>
      <p className="why">{check.why}</p>
      {check.verify && <p className="badge">Rules changed recently. Confirm with the source.</p>}
      <div className="links">
        {check.links.map((l) => (
          <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer">
            {l.label} ↗
          </a>
        ))}
      </div>
      <div className="actions">
        {done ? (
          <button className="ghost" onClick={() => onAnswer(check.id, null)}>Undo</button>
        ) : (
          <>
            <button className="primary" onClick={() => onAnswer(check.id, 'yes')}>Yes, done</button>
            <button className={no ? 'ghost on' : 'ghost'} onClick={() => onAnswer(check.id, no ? null : 'no')}>
              {no ? 'Marked not yet' : 'Not yet'}
            </button>
          </>
        )}
      </div>
      <small className="reviewed">Reviewed {check.lastReviewed}</small>
    </article>
  );
}
