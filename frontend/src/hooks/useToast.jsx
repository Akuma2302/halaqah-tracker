import { useCallback, useEffect, useRef, useState } from 'react';

// Short confirmation message ("Saved", "Deleted") shown above the bottom nav.
// Returns [element to render, show(message)].
export function useToast(duration = 2200) {
  const [message, setMessage] = useState('');
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const show = useCallback(
    (text) => {
      setMessage(text);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(''), duration);
    },
    [duration]
  );

  const element = message ? (
    <div className="toast" role="status">
      {message}
    </div>
  ) : null;

  return [element, show];
}
