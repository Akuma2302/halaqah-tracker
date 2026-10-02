import { ChevronRight } from 'lucide-react';
import { MATHURAT_FADHILAT } from '../features/mathurat/mathuratFadhilat';

function arabicNumber(n) {
  return String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
}

// "Fadhilat" tab of the Mathurat page: why read it, the Quran on zikir,
// virtues of specific readings (each linking back to that reading), and adab.
export default function MathuratFadhilat({ onOpenSection }) {
  const { intro, quran, points, adab, note } = MATHURAT_FADHILAT;

  return (
    <div className="fadhilat">
      <div className="card fadhilat-intro">
        <h2 className="section-label" style={{ marginBottom: 6 }}>
          Fadhilat bacaan al-Mathurat
        </h2>
        <p>{intro}</p>
      </div>

      {quran.map((q) => (
        <div key={q.ref} className="card fadhilat-quran">
          <span className="fadhilat-ref">{q.ref}</span>
          <p className="mathurat-arabic" dir="rtl" lang="ar" style={{ fontSize: 24, margin: '10px 0 6px' }}>
            {q.verses.map((v) => (
              <span key={v.n}>
                {v.ar} <span className="ayah-mark">﴿{arabicNumber(v.n)}﴾</span>{' '}
              </span>
            ))}
          </p>
          <p className="mathurat-meaning" style={{ borderTop: 'none', paddingTop: 0 }}>
            {q.verses.map((v) => v.ms).join(' ')}
          </p>
        </div>
      ))}

      <h2 className="section-label fadhilat-heading">Kelebihan bacaan dalam al-Mathurat</h2>
      <div className="fadhilat-points">
        {points.map((p) => (
          <div key={p.section} className="card fadhilat-point">
            <div className="fadhilat-point-head">
              <span className="mathurat-num">{p.section}</span>
              <span className="fadhilat-point-title">{p.title}</span>
            </div>
            <p className="fadhilat-point-text">{p.text}</p>
            <div className="fadhilat-point-foot">
              <span className="fadhilat-source">{p.source}</span>
              <button type="button" className="fadhilat-open" onClick={() => onOpenSection(p.section)}>
                Baca <ChevronRight size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card fadhilat-adab">
        <h2 className="section-label" style={{ marginBottom: 8 }}>
          Adab mengamalkan zikir
        </h2>
        <ul>
          {adab.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </div>

      <p className="mathurat-source">{note}</p>
    </div>
  );
}
