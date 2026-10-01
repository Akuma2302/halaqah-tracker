import { BookOpen } from 'lucide-react';
import { useDelayedFlag } from '../hooks/useDelayedFlag';

export default function BootScreen() {
  const slow = useDelayedFlag(true);

  return (
    <div className="center-screen">
      <div className="boot">
        <span className="brand-mark boot-mark">
          <BookOpen size={22} />
        </span>
        <span className="boot-name">Double 4 Flat</span>
        <div className="spinner" />
        <p className={`boot-hint${slow ? ' visible' : ''}`} aria-live="polite">
          {slow ? 'Waking up the server… this can take up to a minute the first time.' : ''}
        </p>
      </div>
    </div>
  );
}
