import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAyatAudio } from '../services/quranApi';

// Plays a juzuk or mushaf page ayat by ayat (the API has one audio file per
// ayat for these, not one per juzuk). The list is fetched on first play, in
// batches, and playback starts as soon as the first batch is in.
// Returns { playing, loading, error, currentKey, toggle }.
export function useAyatPlayer(kind, number, speed) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [currentKey, setCurrentKey] = useState(null);

  const audio = useRef(null);
  const files = useRef([]); // [{ key, url }]
  const index = useRef(-1);
  const nextBatch = useRef(1);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const playAt = useCallback((i) => {
    const file = files.current[i];
    if (!file) return false;
    index.current = i;
    setCurrentKey(file.key);
    audio.current.src = file.url;
    audio.current.playbackRate = speedRef.current; // a new src resets the rate
    audio.current.play().catch(() => setError(true));
    return true;
  }, []);

  const loadBatch = useCallback(async () => {
    if (!nextBatch.current || !number) return false;
    const { files: more, nextPage } = await fetchAyatAudio(kind, number, nextBatch.current);
    files.current = [...files.current, ...more];
    nextBatch.current = nextPage;
    return true;
  }, [kind, number]);

  useEffect(() => {
    const el = new Audio();
    el.preload = 'auto';
    audio.current = el;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onError = () => el.getAttribute('src') && setError(true);
    // Next ayat; if the list is used up but more batches exist, fetch one first.
    const onEnded = async () => {
      const next = index.current + 1;
      if (playAt(next)) return;
      try {
        if ((await loadBatch()) && playAt(next)) return;
        index.current = -1; // finished: Listen starts again from the top
        setCurrentKey(null);
      } catch {
        setError(true);
      }
    };
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onError);
    return () => {
      el.pause();
      el.removeAttribute('src');
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onError);
    };
  }, [playAt, loadBatch]);

  useEffect(() => {
    if (audio.current) audio.current.playbackRate = speed;
  }, [speed]);

  const toggle = useCallback(async () => {
    const el = audio.current;
    if (!el) return;
    if (!el.paused) {
      el.pause();
      return;
    }
    setError(false);
    if (index.current >= 0 && el.getAttribute('src')) {
      el.play().catch(() => setError(true));
      return;
    }
    try {
      if (!files.current.length) {
        setLoading(true);
        await loadBatch();
      }
      if (!playAt(0)) setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [loadBatch, playAt]);

  return { playing, loading, error, currentKey, toggle };
}
