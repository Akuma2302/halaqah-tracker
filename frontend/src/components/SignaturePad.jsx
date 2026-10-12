import { useEffect, useRef, useState } from 'react';
import { Eraser, PenLine } from 'lucide-react';

const INK = '#16302b';

// A box to sign in with a finger, a stylus or the mouse. The parent keeps a
// ref and calls `ref.current.toBlob()` to get the signature as a PNG (null if
// nothing was drawn). It is always dark ink on white, whatever the theme, so
// it reads on a printed report.
export default function SignaturePad({ padRef, label = 'Sign here', onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const [signed, setSigned] = useState(false);

  // Sized to the box at the screen's own sharpness, and kept white underneath.
  function prepare() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.min(3, window.devicePixelRatio || 1);
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
  }

  function clear() {
    prepare();
    setSigned(false);
    onChange?.(false);
  }

  useEffect(() => {
    prepare();
    if (padRef) {
      padRef.current = {
        toBlob: () => new Promise((resolve) => (signedRef.current ? canvasRef.current.toBlob(resolve, 'image/png') : resolve(null))),
        clear
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The latest "signed" for toBlob, which is created once.
  const signedRef = useRef(false);
  useEffect(() => {
    signedRef.current = signed;
  }, [signed]);

  const point = (e) => {
    const box = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  };

  function start(e) {
    e.preventDefault();
    canvasRef.current.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    last.current = point(e);
    // A tap leaves a dot, so a short mark still counts.
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, 1.1, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
    if (!signedRef.current) {
      signedRef.current = true;
      setSigned(true);
      onChange?.(true);
    }
  }

  function move(e) {
    if (!drawing.current) return;
    e.preventDefault();
    const next = point(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
    last.current = next;
  }

  function end() {
    drawing.current = false;
  }

  return (
    <div className={`signature-pad${signed ? ' signed' : ''}`}>
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
        role="img"
        aria-label={signed ? 'Signature' : label}
      />
      {!signed && (
        <span className="signature-pad-hint">
          <PenLine size={14} /> {label}
        </span>
      )}
      {signed && (
        <button type="button" className="btn btn-ghost btn-sm signature-pad-clear" onClick={clear}>
          <Eraser size={13} /> Clear
        </button>
      )}
    </div>
  );
}
