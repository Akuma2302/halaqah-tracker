import { useEffect, useState } from 'react';
import { Check, Copy, Instagram, MessageCircle, Music2 } from 'lucide-react';
import Sheet from './Sheet';
import { useAuth } from '../hooks/useAuth';

export default function ProfileSheet({ open, onClose, title = 'Your profile' }) {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState('');
  const [kampus, setKampus] = useState('');
  // Ways to reach you: a number, a username or a link, as you prefer.
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [tiktok, setTiktok] = useState('');
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
    setWhatsapp(user?.whatsappUrl || '');
    setInstagram(user?.instagramUrl || '');
    setTiktok(user?.tiktokUrl || '');
    setError('');
  }, [open, user]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await updateProfile({
        name: name.trim() || user?.name,
        kampus: kampus.trim(),
        whatsapp: whatsapp.trim(),
        instagram: instagram.trim(),
        tiktok: tiktok.trim()
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't save. Please try again.");
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
          />
        </div>
        <div className="profile-links-title">
          Contact links <span>Optional. Your mentor, mentees and mentoring mates can see these.</span>
        </div>
        <div className="field profile-link">
          <label htmlFor="profile-whatsapp">
            <MessageCircle size={13} /> WhatsApp
          </label>
          <input
            id="profile-whatsapp"
            className="input"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="Phone number, e.g. 012-345 6789"
            inputMode="tel"
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>
        <div className="field profile-link">
          <label htmlFor="profile-instagram">
            <Instagram size={13} /> Instagram
          </label>
          <input
            id="profile-instagram"
            className="input"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="Username or link"
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>
        <div className="field profile-link">
          <label htmlFor="profile-tiktok">
            <Music2 size={13} /> TikTok
          </label>
          <input
            id="profile-tiktok"
            className="input"
            value={tiktok}
            onChange={(e) => setTiktok(e.target.value)}
            placeholder="Username or link"
            autoCapitalize="none"
            autoCorrect="off"
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
