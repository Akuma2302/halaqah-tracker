import { useEffect, useState } from 'react';
import { BookMarked } from 'lucide-react';
import client from '../services/apiClient';

const CATEGORIES = [
  { key: 'mathurat_pagi', label: 'Mathurat Pagi' },
  { key: 'mathurat_petang', label: 'Mathurat Petang' },
  { key: 'zikir', label: 'Zikir' },
  { key: 'doa', label: 'Doa' }
];

export default function Compilation() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client
      .get('/content')
      .then((res) => setItems(res.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Compilation</h1>
          <p className="page-subtitle">Mathurat, zikir, and doa in one place</p>
        </div>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : (
        CATEGORIES.map((cat) => {
          const catItems = items.filter((i) => i.category === cat.key);
          return (
            <div className="card" key={cat.key}>
              <span className="section-label">{cat.label}</span>
              {catItems.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 10px' }}>
                  <BookMarked size={22} style={{ marginBottom: 6, color: 'var(--ink-soft)' }} />
                  <p>Content coming soon.</p>
                </div>
              ) : (
                catItems.map((item) => (
                  <div key={item._id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{item.title}</div>
                    {item.arabicText && (
                      <div style={{ fontSize: 18, textAlign: 'right', margin: '8px 0', lineHeight: 1.8 }}>
                        {item.arabicText}
                      </div>
                    )}
                    {item.transliteration && (
                      <div style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--ink-soft)' }}>
                        {item.transliteration}
                      </div>
                    )}
                    {item.translation && <div style={{ fontSize: 13, marginTop: 4 }}>{item.translation}</div>}
                  </div>
                ))
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
