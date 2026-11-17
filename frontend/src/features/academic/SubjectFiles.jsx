import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, File as FileIcon, Folder, FolderInput, FolderPlus, MoreHorizontal, NotebookPen, Pencil, Pin, Trash2, Upload, X } from 'lucide-react';
import client from '../../services/apiClient';
import Sheet from '../../components/Sheet';
import Skeleton from '../../components/Skeleton';
import NoteSheet from './NoteSheet';

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// One subject's files and notes, with user-made folders (one level deep).
export default function SubjectFiles({ subject, showToast }) {
  const base = `/academic/subjects/${subject._id}`;
  const [files, setFiles] = useState(null);
  const [folders, setFolders] = useState([]);
  const [folderId, setFolderId] = useState(null); // folder being viewed; null = top level
  const [uploading, setUploading] = useState(false);
  const [nameEdit, setNameEdit] = useState(null); // { id: folderId | null (new), name }
  const [menuFor, setMenuFor] = useState(null);
  const [moving, setMoving] = useState(null); // file (or note, with isNote) being moved
  const [notes, setNotes] = useState([]);
  // The note open in the sheet: { id, fresh } (fresh: just made, opens for writing).
  const [openNote, setOpenNote] = useState(null);
  const [saveState, setSaveState] = useState('');
  const saveTimers = useRef({});

  useEffect(() => {
    client
      .get(`${base}/files`)
      .then((res) => setFiles(res.data))
      .catch(() => setFiles([]));
    client
      .get(`${base}/folders`)
      .then((res) => setFolders(res.data))
      .catch(() => setFolders([]));
    client
      .get(`${base}/notes`)
      .then((res) => setNotes(Array.isArray(res.data) ? res.data : []))
      .catch(() => setNotes([]));
  }, [base]);

  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menuFor]);

  const currentFolder = folders.find((f) => f._id === folderId) || null;
  const visibleFiles = (files || []).filter((f) => (f.folderId || null) === folderId);
  // Pinned first, then the latest edited.
  const visibleNotes = notes
    .filter((n) => (n.folderId || null) === folderId)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const countIn = (id) => (files || []).filter((f) => f.folderId === id).length + notes.filter((n) => n.folderId === id).length;

  // ---------- notes ----------
  async function newNote() {
    try {
      const res = await client.post(`${base}/notes`, { folderId, title: '', body: '' });
      setNotes((prev) => [res.data, ...prev]);
      setSaveState('');
      setOpenNote({ id: res.data._id, fresh: true });
    } catch {
      showToast("Couldn't start a note. Try again.");
    }
  }

  // Changes show at once and are saved a moment after typing stops.
  function changeNote(id, change) {
    setNotes((prev) => prev.map((n) => (n._id === id ? { ...n, ...change, updatedAt: new Date().toISOString() } : n)));
    setSaveState('Saving…');
    const timers = saveTimers.current;
    timers[id] = { change: { ...(timers[id]?.change || {}), ...change } };
    clearTimeout(timers[`t${id}`]);
    timers[`t${id}`] = setTimeout(() => flushNote(id), 700);
  }

  async function flushNote(id) {
    const timers = saveTimers.current;
    const pending = timers[id]?.change;
    clearTimeout(timers[`t${id}`]);
    delete timers[id];
    if (!pending) return;
    try {
      await client.patch(`${base}/notes/${id}`, pending);
      setSaveState('Saved');
    } catch {
      setSaveState('Not saved');
      showToast("Couldn't save the note. Check your connection.");
    }
  }

  // Closing saves what's waiting; a note left empty isn't kept.
  async function closeNote() {
    const id = openNote?.id;
    setOpenNote(null);
    if (!id) return;
    const note = notes.find((n) => n._id === id);
    if (note && !note.title.trim() && !note.body.trim()) {
      clearTimeout(saveTimers.current[`t${id}`]);
      delete saveTimers.current[id];
      setNotes((prev) => prev.filter((n) => n._id !== id));
      client.delete(`${base}/notes/${id}`).catch(() => {});
      return;
    }
    await flushNote(id);
  }

  async function deleteNote(id) {
    setOpenNote(null);
    clearTimeout(saveTimers.current[`t${id}`]);
    delete saveTimers.current[id];
    const before = notes;
    setNotes((prev) => prev.filter((n) => n._id !== id));
    try {
      await client.delete(`${base}/notes/${id}`);
      showToast('Note deleted');
    } catch {
      setNotes(before);
      showToast("Couldn't delete the note.");
    }
  }

  async function upload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    if (folderId) formData.append('folderId', folderId);
    formData.append('file', file);
    try {
      const res = await client.post(`${base}/files`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setFiles((prev) => [res.data, ...(prev || [])]);
      showToast('File added');
    } catch {
      showToast("Couldn't upload the file. Try again.");
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function removeFile(file) {
    if (!window.confirm(`Remove "${file.fileName}"?`)) return;
    setFiles((prev) => prev.filter((f) => f._id !== file._id));
    try {
      await client.delete(`${base}/files/${file._id}`);
    } catch {
      showToast("Couldn't remove the file.");
    }
  }

  async function moveFile(file, target) {
    setMoving(null);
    if ((file.folderId || null) === target) return;
    if (file.isNote) {
      setNotes((prev) => prev.map((n) => (n._id === file._id ? { ...n, folderId: target } : n)));
      try {
        await client.patch(`${base}/notes/${file._id}`, { folderId: target });
        showToast(target ? `Moved to ${folders.find((f) => f._id === target)?.name}` : 'Moved out of folder');
      } catch {
        setNotes((prev) => prev.map((n) => (n._id === file._id ? { ...n, folderId: file.folderId } : n)));
        showToast("Couldn't move the note.");
      }
      return;
    }
    setFiles((prev) => prev.map((f) => (f._id === file._id ? { ...f, folderId: target } : f)));
    try {
      await client.patch(`${base}/files/${file._id}`, { folderId: target });
      showToast(target ? `Moved to ${folders.find((f) => f._id === target)?.name}` : 'Moved out of folder');
    } catch {
      setFiles((prev) => prev.map((f) => (f._id === file._id ? file : f)));
      showToast("Couldn't move the file.");
    }
  }

  async function saveFolderName(e) {
    e.preventDefault();
    const name = nameEdit.name.trim();
    if (!name) return;
    try {
      if (nameEdit.id) {
        const res = await client.put(`${base}/folders/${nameEdit.id}`, { name });
        setFolders((prev) => prev.map((f) => (f._id === res.data._id ? res.data : f)));
      } else {
        const res = await client.post(`${base}/folders`, { name });
        setFolders((prev) => [...prev, res.data]);
      }
      setNameEdit(null);
    } catch (err) {
      showToast(err.response?.data?.error || "Couldn't save the folder.");
    }
  }

  async function removeFolder(folder) {
    setMenuFor(null);
    const count = countIn(folder._id);
    const note = count ? ` Its ${count} file${count === 1 ? '' : 's'} and note${count === 1 ? '' : 's'} will move back to Files.` : '';
    if (!window.confirm(`Delete folder "${folder.name}"?${note}`)) return;
    setFolders((prev) => prev.filter((f) => f._id !== folder._id));
    setFiles((prev) => prev.map((f) => (f.folderId === folder._id ? { ...f, folderId: null } : f)));
    setNotes((prev) => prev.map((n) => (n.folderId === folder._id ? { ...n, folderId: null } : n)));
    try {
      await client.delete(`${base}/folders/${folder._id}`);
    } catch {
      showToast("Couldn't delete the folder.");
    }
  }

  const sortedFolders = [...folders].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="subject-files">
      <div className="subject-files-head">
        {currentFolder ? (
          <button type="button" className="files-crumb" onClick={() => setFolderId(null)}>
            <ChevronLeft size={14} /> Files <span>/</span> <strong>{currentFolder.name}</strong>
          </button>
        ) : (
          <span>Files</span>
        )}
        <div className="subject-files-actions">
          {!currentFolder && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNameEdit({ id: null, name: '' })}>
              <FolderPlus size={12} /> Folder
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={newNote}>
            <NotebookPen size={12} /> Note
          </button>
          <label className="btn btn-ghost btn-sm">
            <Upload size={12} /> {uploading ? 'Uploading…' : 'File'}
            <input type="file" hidden onChange={upload} disabled={uploading} />
          </label>
        </div>
      </div>

      {nameEdit && (
        <form className="folder-name-form" onSubmit={saveFolderName}>
          <Folder size={14} />
          <input
            className="input"
            autoFocus
            maxLength={60}
            placeholder="Folder name, e.g. Lecture notes"
            value={nameEdit.name}
            onChange={(e) => setNameEdit((n) => ({ ...n, name: e.target.value }))}
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={!nameEdit.name.trim()}>
            {nameEdit.id ? 'Rename' : 'Create'}
          </button>
          <button type="button" className="icon-btn" onClick={() => setNameEdit(null)} aria-label="Cancel">
            <X size={12} />
          </button>
        </form>
      )}

      {files === null ? (
        <Skeleton variant="cards" count={2} compact />
      ) : (
        <>
          {!currentFolder &&
            sortedFolders.map((folder) => (
              <div key={folder._id} className="subject-folder">
                <button type="button" className="subject-folder-open" onClick={() => setFolderId(folder._id)}>
                  <Folder size={14} className="subject-folder-icon" />
                  <span className="subject-folder-name">{folder.name}</span>
                  <span className="subject-folder-count">{countIn(folder._id)}</span>
                  <ChevronRight size={14} />
                </button>
                <div className="subject-menu" onPointerDown={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setMenuFor(menuFor === folder._id ? null : folder._id)}
                    aria-label={`Options for ${folder.name}`}
                    aria-expanded={menuFor === folder._id}
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  {menuFor === folder._id && (
                    <div className="export-pop" role="menu">
                      <button
                        role="menuitem"
                        onClick={() => {
                          setMenuFor(null);
                          setNameEdit({ id: folder._id, name: folder.name });
                        }}
                      >
                        <Pencil size={14} /> Rename
                      </button>
                      <button role="menuitem" className="danger" onClick={() => removeFolder(folder)}>
                        <Trash2 size={14} /> Delete folder
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

          {visibleNotes.map((n) => (
            <button key={n._id} type="button" className="subject-note" onClick={() => setOpenNote({ id: n._id, fresh: false })}>
              <span className="subject-note-icon">
                <NotebookPen size={14} />
              </span>
              <span className="subject-note-text">
                <strong>
                  {n.title.trim() || 'Untitled note'}
                  {n.pinned && <Pin size={11} className="subject-note-pin" aria-label="Pinned" />}
                </strong>
              </span>
            </button>
          ))}

          {visibleFiles.map((f) => (
            <div key={f._id} className="subject-file">
              <FileIcon size={13} />
              <a href={f.fileUrl} target="_blank" rel="noreferrer">
                {f.fileName}
              </a>
              <span>{formatFileSize(f.fileSize)}</span>
              {(folders.length > 0 || f.folderId) && (
                <button className="icon-btn" onClick={() => setMoving(f)} aria-label={`Move ${f.fileName}`} title="Move to folder">
                  <FolderInput size={12} />
                </button>
              )}
              <button className="icon-btn" onClick={() => removeFile(f)} aria-label={`Remove ${f.fileName}`}>
                <X size={12} />
              </button>
            </div>
          ))}

          {!visibleFiles.length && !visibleNotes.length && (currentFolder || !folders.length) && (
            <p className="log-empty">{currentFolder ? 'This folder is empty.' : 'No files or notes yet.'}</p>
          )}
        </>
      )}

      {(() => {
        const note = openNote && notes.find((n) => n._id === openNote.id);
        const folderName = note?.folderId ? folders.find((f) => f._id === note.folderId)?.name : null;
        return (
          <NoteSheet
            note={note || null}
            startEditing={!!openNote?.fresh}
            saveState={saveState}
            where={`In ${subject.name}${folderName ? ` › ${folderName}` : ''}`}
            onChange={(change) => note && changeNote(note._id, change)}
            onClose={closeNote}
            onDelete={() => note && deleteNote(note._id)}
            onMove={
              folders.length > 0 || note?.folderId
                ? async () => {
                    const n = note;
                    await closeNote();
                    if (n && (n.title.trim() || n.body.trim())) setMoving({ ...n, isNote: true, fileName: n.title.trim() || 'Untitled note' });
                  }
                : undefined
            }
          />
        );
      })()}

      <Sheet open={!!moving} onClose={() => setMoving(null)} title="Move to folder">
        {moving && (
          <div className="move-list">
            <p className="move-file-name">{moving.fileName}</p>
            {[{ _id: null, name: 'Files (no folder)' }, ...sortedFolders].map((target) => {
              const here = (moving.folderId || null) === target._id;
              return (
                <button key={target._id || 'root'} type="button" className={`move-target${here ? ' on' : ''}`} onClick={() => moveFile(moving, target._id)}>
                  <Folder size={15} />
                  <span>{target.name}</span>
                  {here && <em>current</em>}
                </button>
              );
            })}
          </div>
        )}
      </Sheet>
    </div>
  );
}
