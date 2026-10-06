import { useCallback, useState } from 'react';

// Recitation speed for the Quran readers: one setting shared by every reader
// and remembered between visits.
export const SPEEDS = [1, 1.25, 1.5, 0.75];
const SPEED_KEY = 'quran_audio_speed';

function savedSpeed() {
  try {
    const saved = Number(localStorage.getItem(SPEED_KEY));
    return SPEEDS.includes(saved) ? saved : 1;
  } catch {
    return 1;
  }
}

// Returns [speed, nextSpeed]; nextSpeed steps to the following speed.
export function useAudioSpeed() {
  const [speed, setSpeed] = useState(savedSpeed);
  const nextSpeed = useCallback(() => {
    setSpeed((current) => {
      const next = SPEEDS[(SPEEDS.indexOf(current) + 1) % SPEEDS.length];
      try {
        localStorage.setItem(SPEED_KEY, String(next));
      } catch {
        // private mode: the choice just isn't remembered
      }
      return next;
    });
  }, []);
  return [speed, nextSpeed];
}
