import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import Sheet from './Sheet';
import { useAuth } from '../hooks/useAuth';

export default function ProfileSheet({ open, onClose, title = 'Your profile' }) {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState('');
  const [kampus, setKampus] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  function copyId() {
    navigator.clipboard?.writeText(user.memberId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

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
        {user?.memberId && (
          <div className="member-id">
            <div>
              <div className="member-id-label">User ID</div>
              <div className="member-id-value">{user.memberId}</div>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={copyId}>
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
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
