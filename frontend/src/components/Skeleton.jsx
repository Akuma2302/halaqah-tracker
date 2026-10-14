// Grey shapes in the place of what is loading, so the page keeps its layout
// instead of showing a spinner:
//  - 'cards': a list of cards, each with a picture and two lines
//  - 'page':  a header card with figures, then cards (a person, a dashboard)
//  - 'lines': a few lines of text (a sheet, a panel, a small part of a page)
//  - 'mushaf': a page of the Quran
//  - 'verses': ayat with their translation, as more are loaded
const W = ['92%', '78%', '86%', '64%', '88%', '72%'];
const SHORT = ['48%', '36%', '54%', '42%'];

function Bar({ w = '100%', h = 12, round }) {
  return <span className={`sk-bar${round ? ' round' : ''}`} style={{ width: w, height: h }} />;
}

function Card({ i = 0, avatar = true }) {
  return (
    <div className="card sk-card">
      {avatar && <span className="sk-bar sk-pic" />}
      <div className="sk-lines">
        <Bar w={W[i % W.length]} h={14} />
        <Bar w={SHORT[i % SHORT.length]} h={10} />
      </div>
    </div>
  );
}

export default function Skeleton({ variant = 'cards', count, compact }) {
  let body;
  if (variant === 'page') {
    body = (
      <>
        <div className="card sk-hero">
          <div className="sk-hero-top">
            <span className="sk-bar sk-pic big" />
            <div className="sk-lines">
              <Bar w="58%" h={18} />
              <Bar w="38%" h={11} />
            </div>
          </div>
          <div className="sk-figures">
            {[0, 1, 2].map((i) => (
              <div key={i} className="sk-lines center">
                <Bar w="46%" h={18} />
                <Bar w="70%" h={9} />
              </div>
            ))}
          </div>
        </div>
        {Array.from({ length: count || 2 }, (_, i) => (
          <div key={i} className="card sk-block">
            <Bar w="40%" h={15} />
            {[0, 1, 2].map((j) => (
              <Bar key={j} w={W[(i + j) % W.length]} h={11} />
            ))}
          </div>
        ))}
      </>
    );
  } else if (variant === 'lines') {
    body = (
      <div className={`sk-lines sk-text${compact ? ' compact' : ''}`}>
        {Array.from({ length: count || 4 }, (_, i) => (
          <Bar key={i} w={W[i % W.length]} h={compact ? 10 : 12} />
        ))}
      </div>
    );
  } else if (variant === 'mushaf') {
    body = (
      <div className="sk-mushaf">
        {Array.from({ length: count || 13 }, (_, i) => (
          <Bar key={i} w={i === 0 ? '46%' : '100%'} h={16} />
        ))}
      </div>
    );
  } else if (variant === 'verses') {
    body = (
      <div className="sk-verses">
        {Array.from({ length: count || 2 }, (_, i) => (
          <div key={i} className="card sk-block">
            <div className="sk-lines right">
              <Bar w="94%" h={18} />
              <Bar w="70%" h={18} />
            </div>
            <Bar w={W[i % W.length]} h={11} />
            <Bar w="52%" h={11} />
          </div>
        ))}
      </div>
    );
  } else {
    body = (
      <div className="sk-list">
        {Array.from({ length: count || 3 }, (_, i) => (
          <Card key={i} i={i} avatar={!compact} />
        ))}
      </div>
    );
  }
  return (
    <div className={`sk sk-${variant}`} role="status" aria-busy="true" aria-label="Loading">
      {body}
    </div>
  );
}
