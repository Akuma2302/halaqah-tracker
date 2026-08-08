import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { Copy, Send, Paperclip, Calendar, Users, Download, Trophy, MessageSquare } from 'lucide-react';
import client from '../services/apiClient';
import socket from '../services/socket';
import { useAuth } from '../hooks/useAuth';
import { MUTABAAH_FIELDS } from '../features/mutabaah/mutabaahFields';

export default function StudyGroupRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionTime, setSessionTime] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [scoreboard, setScoreboard] = useState(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    client
      .get(`/study-groups/${id}/scoreboard`)
      .then((res) => setScoreboard(res.data))
      .catch(() => setScoreboard([]));
  }, [id]);

  useEffect(() => {
    client
      .get(`/study-groups/${id}`)
      .then((res) => setGroup(res.data))
      .catch(() => navigate('/study-groups'));
    client.get(`/study-groups/${id}/messages`).then((res) => setMessages(res.data)).catch(() => setMessages([]));
  }, [id, navigate]);

  useEffect(() => {
    socket.emit('join-study-group', id);
    function onNewMessage(msg) {
      if (msg.studyGroupId === id) setMessages((prev) => [...prev, msg]);
    }
    socket.on('new-message', onNewMessage);
    return () => socket.off('new-message', onNewMessage);
  }, [id]);

  useEffect(() => {
    if (activeTab === 'chat') messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab]);

  function sendMessage(e) {
    e.preventDefault();
    if (!text.trim()) return;
    socket.emit('send-message', { studyGroupId: id, content: text.trim() });
    setText('');
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await client.post(`/study-groups/${id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      socket.emit('send-message', {
        studyGroupId: id,
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

  async function addSession(e) {
    e.preventDefault();
    if (!sessionTitle.trim() || !sessionTime) return;
    const res = await client.post(`/study-groups/${id}/schedule`, {
      title: sessionTitle.trim(),
      datetime: sessionTime,
      notes: sessionNotes.trim()
    });
    setGroup(res.data);
    setSessionTitle('');
    setSessionTime('');
    setSessionNotes('');
    setShowSchedule(false);
  }

  async function downloadIcs(scheduleId, title) {
    try {
      const res = await client.get(`/study-groups/${id}/schedule/${scheduleId}/ics`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'session'}.ics`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // best-effort
    }
  }

  const showScoreboardTab = group ? group.showMutabaah || group.showStudyHours : false;

  const TABS = useMemo(() => {
    const tabs = [
      { key: 'chat', label: 'Chat', icon: MessageSquare },
      { key: 'members', label: 'Members', icon: Users }
    ];
    if (showScoreboardTab) tabs.push({ key: 'scoreboard', label: 'Scoreboard', icon: Trophy });
    tabs.push({ key: 'schedule', label: 'Schedule', icon: Calendar });
    return tabs;
  }, [showScoreboardTab]);

  // If the group's scoreboard settings hide the tab a user was previously on
  // (e.g. an admin just turned it off), fall back to Chat rather than a blank pane.
  useEffect(() => {
    if (activeTab === 'scoreboard' && !showScoreboardTab) setActiveTab('chat');
  }, [activeTab, showScoreboardTab]);

  if (!group) {
    return (
      <div className="page">
        <div className="spinner" style={{ margin: '40px auto', display: 'block' }} />
      </div>
    );
  }

  const isAdmin = group.members.some((m) => m.userId._id === user?._id && m.role === 'admin');
  const upcoming = [...group.schedule]
    .filter((s) => dayjs(s.datetime).isAfter(dayjs().startOf('day')))
    .sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/study-groups')} style={{ marginBottom: 10 }}>
            ← Your Groups
          </button>
          <h1 className="page-title">{group.name}</h1>
          <p className="page-subtitle">{group.subject || 'No subject set'}</p>
        </div>
        <div
          className="invite-code"
          onClick={() => navigator.clipboard?.writeText(group.inviteCode)}
          title="Click to copy"
        >
          {group.inviteCode}
          <Copy size={13} />
        </div>
      </div>

      {/* Teams-style channel tabs */}
      <div className="room-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`room-tab${activeTab === t.key ? ' active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'chat' && (
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
      )}

      {activeTab === 'members' && (
        <div className="card">
          <span className="section-label">Members ({group.members.length})</span>
          {group.members.map((m) => (
            <div className="member-row" key={m.userId._id}>
              {m.userId.avatarUrl ? <img className="avatar" src={m.userId.avatarUrl} alt="" /> : <div className="avatar" />}
              <div>
                <div className="name">{m.userId.name}</div>
              </div>
              {m.role === 'admin' && (
                <span className="badge badge-gold" style={{ marginLeft: 'auto' }}>
                  Admin
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'scoreboard' && showScoreboardTab && (
        <div className="card">
          <span className="section-label">
            <Trophy size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
            Scoreboard
          </span>
          {!scoreboard ? (
            <div className="spinner" style={{ margin: '10px auto' }} />
          ) : scoreboard.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Couldn't load the scoreboard.</p>
          ) : (
            scoreboard.map((row) => {
              const doneCount = row.mutabaah ? MUTABAAH_FIELDS.filter((f) => row.mutabaah[f.key]).length : 0;
              const parts = [];
              if (group.showMutabaah) parts.push(`Mutabaah ${doneCount}/${MUTABAAH_FIELDS.length} today`);
              if (group.showStudyHours) parts.push(`${row.studyHoursThisWeek}h study this week`);
              return (
                <div className="member-row" key={row.user._id}>
                  {row.user.avatarUrl ? (
                    <img className="avatar" src={row.user.avatarUrl} alt={row.user.name} />
                  ) : (
                    <div className="avatar" />
                  )}
                  <div style={{ flex: 1 }}>
                    <div className="name">{row.user.name}</div>
                    <div className="kampus">{parts.join(' · ')}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span className="section-label" style={{ marginBottom: 0 }}>
              <Calendar size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
              Sessions
            </span>
            {isAdmin && (
              <button className="btn btn-ghost btn-sm" onClick={() => setShowSchedule((s) => !s)}>
                {showSchedule ? 'Cancel' : '+ Add'}
              </button>
            )}
          </div>

          {showSchedule && (
            <form onSubmit={addSession} style={{ marginBottom: 14, maxWidth: 420 }}>
              <div className="field">
                <label>Title</label>
                <input
                  className="input"
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  placeholder="e.g. Bab 3 discussion"
                />
              </div>
              <div className="field">
                <label>Date & time</label>
                <input
                  className="input"
                  type="datetime-local"
                  value={sessionTime}
                  onChange={(e) => setSessionTime(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Notes (optional)</label>
                <input
                  className="input"
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="e.g. Bring your notes"
                />
              </div>
              <button className="btn btn-primary btn-block" type="submit">
                Schedule session
              </button>
            </form>
          )}

          {upcoming.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>No sessions scheduled yet.</p>
          ) : (
            upcoming.map((s, i) => (
              <div className="schedule-item" key={s._id || i}>
                <span className="when">{dayjs(s.datetime).format('D MMM, h:mm A')}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.title}</div>
                  {s.notes && <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{s.notes}</div>}
                </div>
                <button
                  className="icon-btn"
                  onClick={() => downloadIcs(s._id, s.title)}
                  title="Add to calendar (.ics)"
                  aria-label="Add to calendar"
                >
                  <Download size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}