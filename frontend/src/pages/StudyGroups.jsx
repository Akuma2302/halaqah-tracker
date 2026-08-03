import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, GraduationCap } from 'lucide-react';
import client from '../services/apiClient';

export default function StudyGroups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  function loadGroups() {
    setLoading(true);
    client
      .get('/study-groups')
      .then((res) => setGroups(res.data))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadGroups();
  }, []);

  async function createGroup(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await client.post('/study-groups', { name: newName.trim(), subject: newSubject.trim() });
      navigate(`/study-groups/${res.data._id}`);
    } catch {
      setError('Could not create the group. Please try again.');
      setBusy(false);
    }
  }

  async function joinGroup(e) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await client.post('/study-groups/join', { inviteCode: joinCode.trim() });
      navigate(`/study-groups/${res.data._id}`);
    } catch {
      setError("That invite code wasn't found.");
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Study groups</h1>
          <p className="page-subtitle">Chat, share files, and schedule sessions together</p>
        </div>
      </div>

      <div className="grid-2">
        <form className="card" onSubmit={createGroup}>
          <span className="section-label">Create a study group</span>
          <div className="field">
            <label>Group name</label>
            <input
              className="input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Fiqh Muamalat"
            />
          </div>
          <div className="field">
            <label>Subject</label>
            <input
              className="input"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="e.g. Fiqh"
            />
          </div>
          <button className="btn btn-primary btn-block" disabled={busy} type="submit">
            <Plus size={15} /> Create group
          </button>
        </form>

        <form className="card" onSubmit={joinGroup}>
          <span className="section-label">Join with a code</span>
          <div className="field">
            <label>Invite code</label>
            <input
              className="input"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="e.g. 7K2QXM"
            />
          </div>
          <button className="btn btn-ghost btn-block" disabled={busy} type="submit">
            Join group
          </button>
        </form>
      </div>

      {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 12 }}>{error}</p>}

      <div style={{ marginTop: 22 }}>
        <span className="section-label">Your study groups</span>
        {loading ? (
          <div className="spinner" />
        ) : groups.length === 0 ? (
          <div className="card empty-state">
            <GraduationCap size={26} style={{ marginBottom: 8, color: 'var(--ink-soft)' }} />
            <h3>No study groups yet</h3>
            <p>Create one, or join a friend's group with their invite code.</p>
          </div>
        ) : (
          <div className="card">
            {groups.map((g) => (
              <div className="group-list-item" key={g._id} onClick={() => navigate(`/study-groups/${g._id}`)}>
                <div>
                  <div className="group-name">{g.name}</div>
                  <div className="group-meta">
                    {g.subject || 'No subject'} · {g.members.length} member{g.members.length === 1 ? '' : 's'}
                  </div>
                </div>
                <span className="badge badge-gold">Open</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
