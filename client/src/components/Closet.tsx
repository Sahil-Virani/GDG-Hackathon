import { useRef, useState } from 'react';
import { Plus, Shirt, Trash2, Upload } from 'lucide-react';
import type { PrivateView } from '../../../shared/schema';
import { api, compressImage } from '../lib/api';
import { Button, ErrorNotice, Modal, ProtectedImage } from './Primitives';
export function Closet({
  code,
  mine,
  refresh,
  onClose,
}: {
  code: string;
  mine: PrivateView;
  refresh: () => Promise<void>;
  onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState('Top');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function upload(files: FileList | null) {
    if (!files) return;
    setBusy(true);
    setError('');
    try {
      for (const file of Array.from(files)) {
        const image = await compressImage(file);
        await api(`/rooms/${code}/closet`, {
          image,
          category,
          label: label || file.name.replace(/\.[^.]+$/, '').slice(0, 60),
        });
      }
      await refresh();
    } catch (e) {
      setError((e as Error).message);
      await refresh();
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }
  async function remove(id: string) {
    setError('');
    try {
      await api(`/rooms/${code}/closet/${id}`, undefined, 'DELETE');
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal title="Your secret weapons." onClose={onClose} wide>
      <p className="muted">
        A little closet, a lot of possibilities. Your stylist can recommend pieces you already own.
        Only you can see these photos.
      </p>
      <div className="closet-controls">
        <label>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {['Top', 'Bottom', 'Shoes', 'Outerwear', 'Accessory', 'Other'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Label <span className="muted">(optional)</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={60}
            placeholder="The black overshirt"
          />
        </label>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => void upload(e.target.files)}
      />
      <div className="closet-grid">
        {mine.closet.map((item) => (
          <article className="closet-card" key={item.id}>
            <ProtectedImage
              path={`/rooms/${code}/media/closet/${item.id}`}
              alt={item.label || item.category}
            />
            <span>{item.category}</span>
            <b>{item.label || 'Your piece'}</b>
            <button
              className="icon-button"
              aria-label={`Remove ${item.label || item.category}`}
              onClick={() => void remove(item.id)}
            >
              <Trash2 size={14} />
            </button>
          </article>
        ))}
        {mine.closet.length < 12 && (
          <button className="closet-add" onClick={() => input.current?.click()} disabled={busy}>
            <Plus size={28} />
            <b>{busy ? 'Adding your pieces…' : 'Add a piece'}</b>
            <small>JPEG, PNG, WEBP</small>
          </button>
        )}
      </div>
      <ErrorNotice message={error} />
      <div className="closet-foot">
        <span>
          <Shirt size={14} /> {mine.closet.length} / 12 PIECES
        </span>
        <Button
          variant="secondary"
          onClick={() => input.current?.click()}
          disabled={busy || mine.closet.length >= 12}
        >
          <Upload size={15} /> Upload photos
        </Button>
      </div>
    </Modal>
  );
}
