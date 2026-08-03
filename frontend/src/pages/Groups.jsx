import { useEffect, useState } from 'react';
import { Plus, Users, Copy } from 'lucide-react';
import client from '../services/apiClient';
import { MUTABAAH_FIELDS } from '../features/mutabaah/mutabaahFields';

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [todayData, setTodayData] = useState(null);
  const [todayError, setTodayError] = useState(false);
  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function loadGroups() {
    setLoading(true);
    client
      .get('/groups')
      .then((res) => setGroups(res.data))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    if (selected) {
      setTodayData(null);
      setTodayError(false);
      client
        .get(`/groups/${selected}/today`)
        .then((res) => setTodayData(res.data))
        .catch(() => setTodayError(true));
    } else {
      setTodayData(null);
      setTodayError(false);
    }
  }, [selected]);

  async function createGroup(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    setError('');
    try {
      await client.post('/groups', { name: newName.trim() });
      setNewName('');
      loadGroups();
    } catch {
      setError('Could not create the group. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function joinGroup(e) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setBusy(true);
    setError('');
    try {
      await client.post('/groups/join', { inviteCode: joinCode.trim() });
      setJoinCode('');
      loadGroups();
    } catch {
      setError('That invite code was not found.');
    } finally {
      setBusy(false);
    }
  }

  if (selected && todayError) {
    return (
      <div className="page">
        <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)} style={{ marginBottom: 10 }}>
          ← All groups
        </button>
        <p className="page-subtitle">Couldn't load this group. Please try again.</p>
      </div>
    );
  }

  if (selected && !todayData) {
    return (
      <div className="page">
        <div className="spinner" style={{ margin: '40px auto', display: 'block' }} />
      </div>
    );
  }

  if (selected && todayData) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)} style={{ marginBottom: 10 }}>
              ← All groups
            </button>
            <h1 className="page-title">{todayData.group.name}</h1>
            <p className="page-subtitle">Who's completed their mutabaah today</p>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 14 }}>
          <span className="section-label">Invite code</span>
          <div
            className="invite-code"
            onClick={() => navigator.clipboard?.writeText(todayData.group.inviteCode)}
            title="Click to copy"
          >
            {todayData.group.inviteCode}
            <Copy size={13} />
          </div>
        </div>

        <div className="card">
          {todayData.members.map((m) => {
            const count = m.entry ? MUTABAAH_FIELDS.filter((f) => m.entry[f.key]).length : 0;
            return (
              <div className="member-row" key={m.user._id}>
                {m.user.avatarUrl ? (
                  <img className="avatar" src={m.user.avatarUrl} alt={m.user.name} />
                ) : (
                  <div className="avatar" />
                )}
                <div>
                  <div className="name">{m.user.name}</div>
                  {m.user.kampus && <div className="kampus">{m.user.kampus}</div>}
                </div>
                <div className="member-progress">
                  <div className="mini-bar">
                    <div
                      className="mini-bar-fill"
                      style={{ width: `${(count / MUTABAAH_FIELDS.length) * 100}%` }}
                    />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)' }}>
                    {count}/{MUTABAAH_FIELDS.length}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Groups</h1>
          <p className="page-subtitle">Track your mutabaah together with friends</p>
        </div>
      </div>

      <div className="grid-2">
        <form className="card" onSubmit={createGroup}>
          <span className="section-label">Create a group</span>
          <div className="field">
            <label>Group name</label>
            <input
              className="input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Usrah Rabu"
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
        <span className="section-label">Your groups</span>
        {loading ? (
          <div className="spinner" />
        ) : groups.length === 0 ? (
          <div className="card empty-state">
            <Users size={26} style={{ marginBottom: 8, color: 'var(--ink-soft)' }} />
            <h3>No groups yet</h3>
            <p>Create one, or join a friend's group with their invite code.</p>
          </div>
        ) : (
          <div className="card">
            {groups.map((g) => (
              <div className="group-list-item" key={g._id} onClick={() => setSelected(g._id)}>
                <div>
                  <div className="group-name">{g.name}</div>
                  <div className="group-meta">
                    {g.members.length} member{g.members.length === 1 ? '' : 's'}
                  </div>
                </div>
                <span className="badge badge-primary">View today</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
