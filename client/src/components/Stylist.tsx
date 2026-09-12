import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, Lock, Sparkles, X } from 'lucide-react';
import type { Advice } from '../../../shared/schema';
import { api } from '../lib/api';
import { Button, ErrorNotice, ProtectedImage } from './Primitives';
export function Stylist({
  code,
  index,
  onClose,
}: {
  code: string;
  index: number;
  onClose: () => void;
}) {
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ image: string; generated: boolean } | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setAdvice(null);
    setPreview(null);
    void api<{ advice: Advice | null }>(`/rooms/${code}/rounds/${index}/advice`, {})
      .then((data) => {
        if (active) setAdvice(data.advice);
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [code, index, retry]);
  async function tryPreview(itemId: string) {
    setPreviewBusy(true);
    setError('');
    try {
      const result = await api<{ image: string; generated: boolean }>(`/rooms/${code}/try-on`, {
        index,
        itemId,
      });
      setPreview(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPreviewBusy(false);
    }
  }
  return (
    <aside className="stylist-panel" aria-label="Private AI styling coach">
      <div className="panel-head">
        <span className="eyebrow">
          <Sparkles size={14} /> AI STYLIST
        </span>
        <button className="icon-button" onClick={onClose} aria-label="Close styling coach">
          <X size={18} />
        </button>
      </div>
      <div className="private-label">
        <Lock size={12} /> JUST BETWEEN US
      </div>
      {loading ? (
        <div className="coach-loading">
          <span className="judge-spinner">✳</span>
          <h3>Your next move is loading.</h3>
          <p>Your stylist is putting together a game plan.</p>
        </div>
      ) : advice ? (
        <>
          <h2>{advice.headline}</h2>
          <section>
            <span className="coach-section-label">
              <Check size={14} /> WHAT WORKED
            </span>
            <p>{advice.what_worked}</p>
          </section>
          <section className="upgrade-section">
            <span className="coach-section-label">
              <Sparkles size={14} /> LEVEL UP YOUR NEXT FIT
            </span>
            <p>{advice.biggest_upgrade}</p>
          </section>
          <section>
            <span className="coach-section-label">TRY THIS</span>
            {advice.suggestions.map((s, i) => (
              <div key={i} className="suggestion">
                {s.closet_item_id && (
                  <ProtectedImage
                    path={`/rooms/${code}/media/closet/${s.closet_item_id}`}
                    alt="Recommended piece from your closet"
                  />
                )}
                <b>{s.text}</b>
                <p>{s.reason}</p>
                {s.closet_item_id && (
                  <Button
                    variant="secondary"
                    disabled={previewBusy}
                    onClick={() => void tryPreview(s.closet_item_id!)}
                  >
                    {previewBusy ? 'Creating preview…' : 'Show me'} <ArrowUpRight size={15} />
                  </Button>
                )}
              </div>
            ))}
          </section>
          {preview && (
            <div className="preview-result">
              <span className="eyebrow">
                {preview.generated ? 'AI PREVIEW' : 'CLOSET REFERENCE'}
              </span>
              <img
                src={preview.image}
                alt={
                  preview.generated
                    ? 'AI generated styling preview'
                    : 'Original closet garment reference'
                }
                onError={() => {
                  setPreview(null);
                  setError(
                    'The preview could not be displayed. Use your closet piece as a reference.',
                  );
                }}
              />
              <small>
                {preview.generated
                  ? 'An AI styling idea, not a physically exact try-on.'
                  : 'Preview unavailable in this session. Here is your original piece.'}
              </small>
            </div>
          )}
        </>
      ) : (
        <p className="muted">
          No captured look this round. Step into the next round for your personal styling plan.
        </p>
      )}
      <ErrorNotice
        message={error}
        retry={() => {
          setError('');
          setRetry((v) => v + 1);
        }}
      />
      <div className="coach-footer">YOUR STYLE. YOUR CALL.</div>
    </aside>
  );
}
