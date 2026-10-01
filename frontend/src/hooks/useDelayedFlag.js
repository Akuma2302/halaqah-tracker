import { useEffect, useState } from 'react';

// True once `active` has stayed true for `delayMs` — used to show a
// "waking up the server" hint only when a request is genuinely slow.
export function useDelayedFlag(active, delayMs = 3000) {
  const [flag, setFlag] = useState(false);

  useEffect(() => {
    if (!active) {
      setFlag(false);
      return;
    }
    const id = setTimeout(() => setFlag(true), delayMs);
    return () => clearTimeout(id);
  }, [active, delayMs]);

  return flag;
}
