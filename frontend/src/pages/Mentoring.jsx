import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BarChart3, Check, ChevronRight, Copy, Network, Share2, UserPlus } from 'lucide-react';
import MentoringDashboard from '../features/mentoring/MentoringDashboard';
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

// A mentee or mentoring mate in the tree: opens their detail page.
function PersonNode({ person }) {
  const allDone = person.mutabaahDone === person.mutabaahTotal;
  return (
    <Link to={`/mentoring/${person._id}`} className="tree-node tree-link">
      <Avatar person={person} />
      <div className="mentor-body">
        <div className="mentor-name">{person.name}</div>
        <div className="mentor-meta">{[person.memberId, person.kampus].filter(Boolean).join(' · ')}</div>
      </div>
      <span
        className={`badge ${allDone ? 'badge-primary' : 'badge-muted'}`}
        title={`Mutabaah today: ${person.mutabaahDone} of ${person.mutabaahTotal}`}
      >
        {person.mutabaahDone}/{person.mutabaahTotal}
      </span>
      <ChevronRight size={16} className="mentee-chevron" />
    </Link>
  );
}

// Mentoring Tree, drawn as one: my mentor at the top, then me and my
// mentoring mates on the branch below them, then my mentees under me.
// Mates and mentees open their detail; a mentor's own detail is never shown
// to their mentees.
export default function Mentoring() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'dashboard' ? 'dashboard' : 'tree';
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
      setTree((t) => ({ ...t, mentor: res.data.mentor, mates: [] }));
      setMentorInput('');
      load(); // mates depend on who the mentor is
      showToast(res.data.mentor ? `${res.data.mentor.name} is now your mentor` : 'Mentor removed');
    } catch (err) {
      setFormError(err.response?.data?.error || "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function removeMentor() {
    const message = `Remove ${tree.mentor.name} as your mentor? They and your mentoring mates will no longer see your mutabaah and academic detail, and you will no longer see your mates'.`;
    if (window.confirm(message)) saveMentor('');
  }

  function copyId() {
    navigator.clipboard?.writeText(tree.me.memberId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Hand your ID to a mentee: the phone's share sheet where there is one,
  // otherwise it is copied.
  function shareId() {
    const text = `Add me as your mentor on Double 4 Flat. My User ID is ${tree.me.memberId}.`;
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else navigator.clipboard?.writeText(text).then(() => showToast('Invite copied'));
  }

  const mates = tree?.mates || [];
  const mentees = tree?.mentees || [];

  // "You", with your mentees branching underneath.
  const youNode = tree && (
    <div className="tree-item">
      <div className="tree-node you">
        <Avatar person={tree.me} />
        <div className="mentor-body">
          <div className="mentor-name">
            {tree.me.name} <span className="badge badge-gold">You</span>
          </div>
          <div className="mentor-meta">{tree.me.memberId || 'Your User ID is being set up'}</div>
        </div>
        {tree.me.memberId && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={copyId} aria-label="Copy your User ID">
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy ID'}
          </button>
        )}
      </div>

      <div className="tree-branch">
        <div className="tree-caption">My mentees ({mentees.length})</div>
        {mentees.map((m) => (
          <div className="tree-item" key={m._id}>
            <PersonNode person={m} />
          </div>
        ))}
        {mentees.length === 0 && (
          <div className="tree-item">
            <div className="tree-node empty">
              <div className="mentor-body">
                <div className="tree-empty-title">No mentees yet</div>
                <div className="mentor-meta">They appear here once they add your User ID as their mentor.</div>
              </div>
              {tree.me.memberId && (
                <button type="button" className="btn btn-primary btn-sm" onClick={shareId}>
                  <Share2 size={13} /> Share ID
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mentoring Tree</h1>
          <p className="page-subtitle">Your mentor, your mentoring mates and your mentees</p>
        </div>
      </div>

      <div className="range-toggle segmented">
        <button className={view === 'tree' ? 'active' : ''} onClick={() => setParams({}, { replace: true })}>
          <Network size={14} /> Tree
        </button>
        <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setParams({ view: 'dashboard' }, { replace: true })}>
          <BarChart3 size={14} /> Dashboard
        </button>
      </div>

      {view === 'dashboard' ? (
        <MentoringDashboard />
      ) : error ? (
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
          <div className="tree-counts">
            <span>
              <strong>{tree.mentor ? 1 : 0}</strong> mentor
            </span>
            <span>
              <strong>{mates.length}</strong> mate{mates.length === 1 ? '' : 's'}
            </span>
            <span>
              <strong>{mentees.length}</strong> mentee{mentees.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="tree">
            {/* ---------- top of the tree: my mentor, or the place to add one ---------- */}
            {tree.mentor ? (
              <div className="tree-node mentor">
                <Avatar person={tree.mentor} />
                <div className="mentor-body">
                  <div className="tree-role">My mentor</div>
                  <div className="mentor-name">{tree.mentor.name}</div>
                  <div className="mentor-meta">{[tree.mentor.memberId, tree.mentor.kampus].filter(Boolean).join(' · ')}</div>
                </div>
                <button className="btn btn-ghost btn-sm danger-text" onClick={removeMentor} disabled={saving}>
                  Remove
                </button>
              </div>
            ) : (
              <form
                className="tree-node empty tree-add-mentor"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (mentorInput.trim()) saveMentor(mentorInput);
                }}
              >
                <label htmlFor="mentor-id" className="tree-role">
                  <UserPlus size={13} /> Add your mentor by their User ID
                </label>
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
                  Your mentor, and the other mentees under them, will see your mutabaah and academic detail. You can
                  remove them at any time.
                </p>
              </form>
            )}

            {/* ---------- the branch under my mentor: me and my mates ---------- */}
            <div className="tree-branch">
              {tree.mentor && (
                <div className="tree-caption">
                  Under your mentor · {mates.length ? `you and ${mates.length} mate${mates.length === 1 ? '' : 's'}` : 'just you so far'}
                </div>
              )}
              {youNode}
              {mates.map((m) => (
                <div className="tree-item" key={m._id}>
                  <PersonNode person={m} />
                </div>
              ))}
              {tree.mentor && mates.length === 0 && (
                <div className="tree-item">
                  <div className="tree-node empty">
                    <div className="mentor-body">
                      <div className="tree-empty-title">No mentoring mates yet</div>
                      <div className="mentor-meta">Others who add {tree.mentor.name} as their mentor will appear here.</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          {(mates.length > 0 || mentees.length > 0) && (
            <p className="mentor-note">The number beside each person is their mutabaah today, out of 7. Tap someone to see their updates.</p>
          )}
        </>
      )}
      {toast}
    </div>
  );
}
