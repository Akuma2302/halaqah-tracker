// Recitation speed button shown next to Listen; tap to step to the next speed.
export default function SpeedButton({ speed, onClick }) {
  return (
    <button
      type="button"
      className={`btn btn-ghost btn-sm quran-speed${speed !== 1 ? ' on' : ''}`}
      onClick={onClick}
      aria-label={`Recitation speed ${speed}×. Tap to change.`}
      title="Recitation speed"
    >
      {speed}×
    </button>
  );
}
