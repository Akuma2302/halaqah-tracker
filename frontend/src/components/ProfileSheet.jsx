import { useEffect, useState } from 'react';
import Sheet from './Sheet';
import { useAuth } from '../hooks/useAuth';

export default function ProfileSheet({ open, onClose, title = 'Your profile' }) {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState('');
  const [kampus, setKampus] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(user?.name || '');
    setKampus(user?.kampus || '');
    setError('');
  }, [open, user]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await updateProfile({ name: name.trim() || user?.name, kampus: kampus.trim() });
      onClose();
    } catch {
      setError("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <form onSubmit={save}>
        <div className="field">
          <label>Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </div>
        <div className="field">
          <label>Kampus</label>
          <input
            className="input"
            value={kampus}
            onChange={(e) => setKampus(e.target.value)}
            placeholder="e.g. UTM Skudai"
            autoFocus
          />
        </div>
        {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
    </Sheet>
  );
}
