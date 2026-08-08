import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, GraduationCap, FolderPlus, Folder, X, Trophy } from 'lucide-react';
import client from '../services/apiClient';

export default function StudyGroups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState([]);
  const [activeFolder, setActiveFolder] = useState('all'); // 'all' or a folder _id
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderPickerFor, setFolderPickerFor] = useState(null); // group _id whose picker is open

  const [newName, setNewName] = useState('');
  const [newSubject, setNewSubject] = useState('');
  // Two-step create flow: fill in details, then — per the spec — a follow-up
  // "Which scoreboard want to include?" prompt appears before the group is
  // actually created.
  const [createStep, setCreateStep] = useState('details'); // 'details' | 'scoreboard'
  const [showMutabaah, setShowMutabaah] = useState(true);
  const [showStudyHours, setShowStudyHours] = useState(true);

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

  function loadFolders() {
    client
      .get('/folders')
      .then((res) => setFolders(res.data))
      .catch(() => setFolders([]));
  }

  useEffect(() => {
    loadGroups();
    loadFolders();
  }, []);

  function goToScoreboardStep(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreateStep('scoreboard');
  }

  function toggleNoScoreboard(checked) {
    if (checked) {
      setShowMutabaah(false);
      setShowStudyHours(false);
    } else {
      setShowMutabaah(true);
      setShowStudyHours(true);
    }
  }

  async function finishCreateGroup() {
    setBusy(true);
    setError('');
    try {
      const res = await client.post('/study-groups', {
        name: newName.trim(),
        subject: newSubject.trim(),
        showMutabaah,
        showStudyHours
      });
      navigate(`/study-groups/${res.data._id}`);
    } catch {
      setError('Could not create the group. Please try again.');
      setBusy(false);
    }
  }

  function cancelCreate() {
    setCreateStep('details');
    setShowMutabaah(true);
    setShowStudyHours(true);
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

  async function createFolder(e) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const res = await client.post('/folders', { name: newFolderName.trim() });
      setFolders((prev) => [...prev, res.data]);
      setActiveFolder(res.data._id);
      setNewFolderName('');
      setNewFolderOpen(false);
    } catch {
      // best-effort
    }
  }

  async function deleteFolder(folderId) {
    if (!window.confirm('Delete this folder? Groups inside it are not deleted, just ungrouped.')) return;
    setFolders((prev) => prev.filter((f) => f._id !== folderId));
    if (activeFolder === folderId) setActiveFolder('all');
    try {
      await client.delete(`/folders/${folderId}`);
    } catch {
      loadFolders();
    }
  }

  async function toggleGroupInFolder(folderId, groupId, isIn) {
    setFolders((prev) =>
      prev.map((f) =>
        f._id === folderId
          ? { ...f, groupIds: isIn ? f.groupIds.filter((id) => id !== groupId) : [...f.groupIds, groupId] }
          : f
      )
    );
    try {
      if (isIn) {
        await client.delete(`/folders/${folderId}/groups/${groupId}`);
      } else {
        await client.post(`/folders/${folderId}/groups`, { studyGroupId: groupId });
      }
    } catch {
      loadFolders();
    }
  }

  const visibleGroups =
    activeFolder === 'all'
      ? groups
      : groups.filter((g) => folders.find((f) => f._id === activeFolder)?.groupIds.includes(g._id));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Your Groups</h1>
          <p className="page-subtitle">Chat, see the mutabaah scoreboard, study hours, and schedule sessions together</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          {createStep === 'details' ? (
            <form onSubmit={goToScoreboardStep}>
              <span className="section-label">Create a group</span>
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
              <button className="btn btn-primary btn-block" type="submit">
                <Plus size={15} /> Create group
              </button>
            </form>
          ) : (
            <div>
              <span className="section-label">
                <Trophy size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                Which scoreboard want to include?
              </span>
              <p className="page-subtitle" style={{ marginTop: -4, marginBottom: 14 }}>
                Choose what group members can see about each other in "{newName.trim()}".
              </p>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={showMutabaah}
                  onChange={(e) => setShowMutabaah(e.target.checked)}
                />
                Mutabaah
              </label>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={showStudyHours}
                  onChange={(e) => setShowStudyHours(e.target.checked)}
                />
                Study Hour
              </label>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={!showMutabaah && !showStudyHours}
                  onChange={(e) => toggleNoScoreboard(e.target.checked)}
                />
                No Need
              </label>
              {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{error}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button className="btn btn-primary" onClick={finishCreateGroup} disabled={busy}>
                  {busy ? 'Creating…' : 'Create group'}
                </button>
                <button className="btn btn-ghost" onClick={cancelCreate} disabled={busy}>
                  Back
                </button>
              </div>
            </div>
          )}
        </div>

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

      {error && createStep === 'details' && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 12 }}>{error}</p>}

      {/* Folder tabs, Telegram-style: All + each folder + New folder */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 24, marginBottom: 10 }}>
        <button
          className={`btn btn-sm ${activeFolder === 'all' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveFolder('all')}
        >
          All
        </button>
        {folders.map((f) => (
          <span key={f._id} style={{ display: 'inline-flex', alignItems: 'center' }}>
            <button
              className={`btn btn-sm ${activeFolder === f._id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveFolder(f._id)}
            >
              {f.name}
            </button>
            {activeFolder === f._id && (
              <button className="icon-btn" style={{ width: 22, height: 22, marginLeft: -6 }} onClick={() => deleteFolder(f._id)} aria-label="Delete folder">
                <X size={11} />
              </button>
            )}
          </span>
        ))}

        {newFolderOpen ? (
          <form onSubmit={createFolder} style={{ display: 'flex', gap: 6 }}>
            <input
              className="input"
              style={{ padding: '4px 10px', width: 140 }}
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              onBlur={() => !newFolderName && setNewFolderOpen(false)}
            />
          </form>
        ) : (
          <button className="btn btn-ghost btn-sm" onClick={() => setNewFolderOpen(true)}>
            <FolderPlus size={13} /> New folder
          </button>
        )}
      </div>

      <div>
        {loading ? (
          <div className="spinner" />
        ) : visibleGroups.length === 0 ? (
          <div className="card empty-state">
            <GraduationCap size={26} style={{ marginBottom: 8, color: 'var(--ink-soft)' }} />
            <h3>{activeFolder === 'all' ? 'No groups yet' : 'No groups in this folder'}</h3>
            <p>
              {activeFolder === 'all'
                ? "Create one, or join a friend's group with their invite code."
                : 'Add a group to this folder from the folder icon on each group.'}
            </p>
          </div>
        ) : (
          <div className="card">
            {visibleGroups.map((g) => (
              <div className="group-list-item" key={g._id}>
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => navigate(`/study-groups/${g._id}`)}>
                  <div className="group-name">{g.name}</div>
                  <div className="group-meta">
                    {g.subject || 'No subject'} · {g.members.length} member{g.members.length === 1 ? '' : 's'}
                  </div>
                </div>

                <span style={{ position: 'relative' }}>
                  <button
                    className="icon-btn"
                    onClick={() => setFolderPickerFor(folderPickerFor === g._id ? null : g._id)}
                    aria-label="Add to folder"
                    title="Add to folder"
                  >
                    <Folder size={15} />
                  </button>
                  {folderPickerFor === g._id && (
                    <div
                      className="card"
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 30,
                        zIndex: 5,
                        width: 200,
                        padding: 10,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
                      }}
                    >
                      <span className="section-label" style={{ marginBottom: 6 }}>
                        Add to folder
                      </span>
                      {folders.length === 0 ? (
                        <p style={{ fontSize: 12, color: 'var(--ink-soft)' }}>No folders yet — create one above.</p>
                      ) : (
                        folders.map((f) => {
                          const isIn = f.groupIds.includes(g._id);
                          return (
                            <label key={f._id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, padding: '4px 0' }}>
                              <input type="checkbox" checked={isIn} onChange={() => toggleGroupInFolder(f._id, g._id, isIn)} />
                              {f.name}
                            </label>
                          );
                        })
                      )}
                    </div>
                  )}
                </span>

                <span className="badge badge-gold" onClick={() => navigate(`/study-groups/${g._id}`)} style={{ cursor: 'pointer' }}>
                  Open
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}