import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X, ArrowUpRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSession } from '../stores/session';
export function Brand() {
  return (
    <a href="/" className="brand" aria-label="Outfit Battle home">
      <span className="brand-mark">◈</span>
      <span>
        OUTFIT<span className="brand-light">BATTLE</span>
        <small>THE RUNWAY IS YOURS</small>
      </span>
    </a>
  );
}
export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'gold';
}) {
  return (
    <button className={`button ${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const prev = document.activeElement as HTMLElement;
    return () => {
      dialog?.close();
      prev?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <div>
          <span className="eyebrow">
            <Sparkles size={12} /> YOUR NEXT MOVE
          </span>
          <h2>{title}</h2>
        </div>
        <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) {
  return message ? (
    <div className="error-notice" role="alert">
      {message}
      {retry && (
        <button onClick={retry}>
          Try again <ArrowUpRight size={14} />
        </button>
      )}
    </div>
  ) : null;
}
export function ProtectedImage({
  path,
  alt,
  ...props
}: { path: string; alt: string } & React.ImgHTMLAttributes<HTMLImageElement>) {
  const token = useSession((s) => s.credentials?.accessToken);
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    const controller = new AbortController();
    setUrl('');
    void fetch(`/api${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error('Unavailable');
        return r.blob();
      })
      .then((blob) => {
        if (active) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, token]);
  return url ? (
    <img src={url} alt={alt} {...props} />
  ) : (
    <span className="image-loading" aria-label="Loading photo" />
  );
}
export function Score({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1100);
      setDisplay(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return (
    <motion.span initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      {display.toFixed(1)}
    </motion.span>
  );
}
