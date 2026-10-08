import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, Copy, User, Users } from 'lucide-react';
import client from '../services/apiClient';
import { useToast } from '../hooks/useToast';
import { toDateKey } from '../features/academic/weekUtils';

function Avatar({ person }) {
  return person.avatarUrl ? (
    <img className="avatar mentor-avatar" src={person.avatarUrl} alt="" />
  ) : (
    <div className="avatar mentor-avatar mentor-avatar-letter">{(person.name || '?').trim()[0]?.toUpperCase()}</div>
  );
}

// Mentoring Tree: my mentor (linked by entering their User ID) and my mentees
// (everyone who entered mine). A mentor can open a mentee to see their detail.
export default function Mentoring() {
  const [tree, setTree] = useState(null);
  const [error, setError] = useState(false);
  const [mentorInput, setMentorInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [copied, setCopied] = useState(false);
  const [toast, showToast] = useToast();

  function load() {
    setError(false);
    client
      .get('/mentoring/tree', { params: { date: toDateKey(new Date()) } })
      .then((res) => setTree(res.data))
      .catch(() => setError(true));
  }

  useEffect(load, []);

  async function saveMentor(memberId) {
    setSaving(true);
    setFormError('');
    try {
      const res = await client.put('/mentoring/mentor', { memberId });
      setTree((t) => ({ ...t, mentor: res.data.mentor }));
      setMentorInput('');
      showToast(res.data.mentor ? `${res.data.mentor.name} is now your mentor` : 'Mentor removed');
    } catch (err) {
      setFormError(err.response?.data?.error || "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function removeMentor() {
    if (window.confirm(`Remove ${tree.mentor.name} as your mentor? They will no longer see your mutabaah and academic detail.`)) {
      saveMentor('');
    }
  }

  function copyId() {
    navigator.clipboard?.writeText(tree.me.memberId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mentoring Tree</h1>
          <p className="page-subtitle">Your mentor, and the mentees who follow you</p>
        </div>
      </div>

      {error ? (
        <div className="card empty-state">
          <h3>Couldn't load your mentoring tree</h3>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={load}>
            Try again
          </button>
        </div>
      ) : !tree ? (
        <div className="spinner" style={{ margin: '24px auto', display: 'block' }} />
      ) : (
        <>
          {tree.me.memberId && (
            <div className="member-id">
              <div>
                <div className="member-id-label">Your User ID · give this to your mentees</div>
                <div className="member-id-value">{tree.me.memberId}</div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={copyId}>
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}

          <h2 className="mentor-heading">
            <User size={15} /> My mentor
          </h2>
          {tree.mentor ? (
            <div className="card mentor-card">
              <Avatar person={tree.mentor} />
              <div className="mentor-body">
                <div className="mentor-name">{tree.mentor.name}</div>
                <div className="mentor-meta">{[tree.mentor.memberId, tree.mentor.kampus].filter(Boolean).join(' · ')}</div>
              </div>
              <button className="btn btn-ghost btn-sm danger-text" onClick={removeMentor} disabled={saving}>
                Remove
              </button>
            </div>
          ) : (
            <form
              className="card mentor-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (mentorInput.trim()) saveMentor(mentorInput);
              }}
            >
              <label htmlFor="mentor-id">Mentor's User ID</label>
              <div className="mentor-form-row">
                <input
                  id="mentor-id"
                  className="input"
                  value={mentorInput}
                  onChange={(e) => setMentorInput(e.target.value)}
                  placeholder="e.g. D4F-0007"
                  autoCapitalize="characters"
                />
                <button className="btn btn-primary" type="submit" disabled={saving || !mentorInput.trim()}>
                  {saving ? 'Saving…' : 'Add'}
                </button>
              </div>
              {formError && <p className="form-error">{formError}</p>}
              <p className="mentor-note">
                Adding a mentor lets them see your mutabaah and academic detail. You can remove them at any time.
              </p>
            </form>
          )}

          <h2 className="mentor-heading">
            <Users size={15} /> My mentees ({tree.mentees.length})
          </h2>
          {tree.mentees.length === 0 ? (
            <div className="card">
              <p className="log-empty">
                You don't have any mentees yet. They appear here once they add your User ID as their mentor.
              </p>
            </div>
          ) : (
            <div className="mentee-list">
              {tree.mentees.map((m) => (
                <Link key={m._id} to={`/mentoring/${m._id}`} className="card mentor-card mentee-link">
                  <Avatar person={m} />
                  <div className="mentor-body">
                    <div className="mentor-name">{m.name}</div>
                    <div className="mentor-meta">{[m.memberId, m.kampus].filter(Boolean).join(' · ')}</div>
                  </div>
                  <span className={`badge ${m.mutabaahDone === m.mutabaahTotal ? 'badge-primary' : 'badge-muted'}`}>
                    {m.mutabaahDone}/{m.mutabaahTotal} today
                  </span>
                  <ChevronRight size={16} className="mentee-chevron" />
                </Link>
              ))}
            </div>
          )}
        </>
      )}
      {toast}
    </div>
  );
}
