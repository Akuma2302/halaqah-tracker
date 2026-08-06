import { useEffect, useRef, useState } from 'react';
import { Plus, Users, Copy, Send, Paperclip } from 'lucide-react';
import client from '../services/apiClient';
import socket from '../services/socket';
import { useAuth } from '../hooks/useAuth';
import { MUTABAAH_FIELDS } from '../features/mutabaah/mutabaahFields';

export default function Groups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [todayData, setTodayData] = useState(null);
  const [todayError, setTodayError] = useState(false);
  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

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
      setMessages([]);
      client
        .get(`/groups/${selected}/today`)
        .then((res) => setTodayData(res.data))
        .catch(() => setTodayError(true));
      client
        .get(`/groups/${selected}/messages`)
        .then((res) => setMessages(res.data))
        .catch(() => setMessages([]));
    } else {
      setTodayData(null);
      setTodayError(false);
      setMessages([]);
    }
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    socket.emit('join-group', selected);
    function onNewMessage(msg) {
      if (msg.groupId === selected) setMessages((prev) => [...prev, msg]);
    }
    socket.on('new-group-message', onNewMessage);
    return () => socket.off('new-group-message', onNewMessage);
  }, [selected]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  function sendMessage(e) {
    e.preventDefault();
    if (!text.trim()) return;
    socket.emit('send-group-message', { groupId: selected, content: text.trim() });
    setText('');
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await client.post(`/groups/${selected}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      socket.emit('send-group-message', {
        groupId: selected,
        content: '',
        attachmentUrl: res.data.url,
        attachmentType: res.data.type
      });
    } catch {
      // Best-effort for the starter app - wire up a toast here later
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
          <div
            className="invite-code"
            onClick={() => navigator.clipboard?.writeText(todayData.group.inviteCode)}
            title="Click to copy"
          >
            {todayData.group.inviteCode}
            <Copy size={13} />
          </div>
        </div>

        <div className="grid-2">
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="chat-window">
              <div className="chat-messages">
                {messages.map((m) => {
                  const mine = m.senderId?._id === user?._id;
                  return (
                    <div className={`chat-bubble${mine ? ' mine' : ''}`} key={m._id}>
                      {!mine && <div className="sender">{m.senderId?.name}</div>}
                      {m.content && <div className="content">{m.content}</div>}
                      {m.attachmentType === 'image' && m.attachmentUrl && (
                        <img src={m.attachmentUrl} alt="Shared attachment" />
                      )}
                      {m.attachmentType === 'file' && m.attachmentUrl && (
                        <a className="file-link" href={m.attachmentUrl} target="_blank" rel="noreferrer">
                          <Paperclip size={12} /> Download file
                        </a>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              <form className="chat-input-row" onSubmit={sendMessage}>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  aria-label="Attach file"
                >
                  <Paperclip size={15} />
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFile} style={{ display: 'none' }} />
                <input
                  className="input"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={uploading ? 'Uploading…' : 'Type a message'}
                />
                <button className="icon-btn" type="submit" aria-label="Send">
                  <Send size={15} />
                </button>
              </form>
            </div>
          </div>

          <div className="card">
            <span className="section-label">Today's progress</span>
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
                <span className="badge badge-primary">View & chat</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
