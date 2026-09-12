import { useEffect, useRef } from 'react';
import type * as OT from '@opentok/client';
import { CameraOff, Crown, Lock, MicOff, Radio, ScanLine, WifiOff } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { PublicParticipant } from '../../../shared/schema';
import type { Guidance } from '../lib/pose';
import { ProtectedImage } from './Primitives';
export function VideoTile({
  person,
  local,
  stream,
  remote,
  session,
  onVideo,
  guidance,
  countdown,
  host,
  code,
  roundIndex,
  hasImage,
  reactions,
  onReact,
}: {
  person: PublicParticipant;
  local: boolean;
  stream?: MediaStream | null;
  remote?: OT.Stream;
  session?: OT.Session | null;
  onVideo?: (v: HTMLVideoElement | null) => void;
  guidance?: Guidance;
  countdown?: number | null;
  host: boolean;
  code: string;
  roundIndex: number;
  hasImage?: boolean;
  reactions: { id: string; emoji: string }[];
  onReact: (emoji: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const subscriber = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (video.current && stream) {
      video.current.srcObject = stream;
      void video.current.play().catch(() => {});
      onVideo?.(video.current);
    }
    return () => {
      onVideo?.(null);
    };
  }, [stream, onVideo]);
  useEffect(() => {
    if (!remote || !session || !subscriber.current) return;
    const sub = session.subscribe(
      remote,
      subscriber.current,
      {
        insertMode: 'append',
        width: '100%',
        height: '100%',
        fitMode: 'contain',
        showControls: false,
      },
      () => {},
    );
    return () => {
      try {
        session.unsubscribe(sub);
      } catch {
        /* Session may already be disconnected. */
      }
    };
  }, [remote, session]);
  const isLocked = person.status === 'locked';
  return (
    <motion.article
      layout
      className={`video-tile ${local ? 'is-local' : ''} ${guidance?.valid ? 'pose-valid' : ''} ${isLocked ? 'is-locked' : ''}`}
    >
      <div className="video-canvas">
        {local ? (
          <video ref={video} autoPlay playsInline muted className="local-video" />
        ) : (
          <div ref={subscriber} className="subscriber-video" />
        )}
        {((!local && !remote) || (local && !stream) || !person.camera) && (
          <div className="video-placeholder">
            <span className="avatar-letter">{person.name.charAt(0).toUpperCase()}</span>
            <span>
              {!person.connected ? 'Reconnecting' : person.camera ? 'Joining video…' : 'Camera off'}
            </span>
            {!person.camera && <CameraOff size={18} />}
          </div>
        )}
        {hasImage && isLocked && (
          <ProtectedImage
            className="locked-photo"
            path={`/rooms/${code}/media/capture/${person.id}?round=${roundIndex}`}
            alt={`${person.name}'s captured outfit`}
          />
        )}
      </div>
      <div className="tile-top">
        <span className={`tile-badge ${local ? 'mint' : ''}`}>
          {local ? (
            <>
              <Radio size={11} /> YOU
            </>
          ) : (
            'ON THE RUNWAY'
          )}
        </span>
        {host && (
          <span className="tile-badge">
            <Crown size={12} /> HOST
          </span>
        )}
        {!person.connected && (
          <span className="tile-badge">
            <WifiOff size={12} /> OFFLINE
          </span>
        )}
      </div>
      {guidance && !isLocked && person.status !== 'judging' && (
        <div className={`framing-overlay ${guidance.valid ? 'valid' : ''}`}>
          <span />
          <span />
          <span />
          <span />
          <div className="pose-guide">
            <ScanLine size={16} />
            {guidance.message}
          </div>
        </div>
      )}
      <AnimatePresence>
        {countdown != null && (
          <motion.div
            className="countdown"
            key={countdown}
            initial={{ scale: 1.25, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <span>{countdown}</span>
            <small>HOLD THAT LOOK</small>
          </motion.div>
        )}
      </AnimatePresence>
      {isLocked && (
        <div className="locked-overlay">
          <Lock size={25} />
          <strong>LOOK LOCKED</strong>
          <span>Your score is under wraps.</span>
        </div>
      )}
      {person.status === 'judging' && (
        <div className="locked-overlay judging-overlay">
          <span className="scan-beam" />
          <SparkleSpinner />
          <strong>THE JUDGE IS LOOKING</strong>
          <span>Good things take a second.</span>
        </div>
      )}
      <div className="tile-bottom">
        <div>
          <b>{person.name}</b>
          <small>
            {person.status === 'locked'
              ? 'Locked in'
              : person.status === 'judging'
                ? 'AI judging'
                : local
                  ? 'Your personal runway'
                  : 'Ready for a fit check'}
          </small>
        </div>
        {!person.mic && <MicOff size={16} />}
        <div className="reaction-picker" aria-label={`React to ${person.name}`}>
          {['🔥', '👑', '😭', '💀', '✨'].map((emoji) => (
            <button
              key={emoji}
              onClick={() => onReact(emoji)}
              aria-label={`Send ${emoji} to ${person.name}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
      <div className="reactions-layer">
        {reactions.map((r) => (
          <motion.span
            key={r.id}
            initial={{ y: 30, opacity: 0, scale: 0.6 }}
            animate={{ y: -130, opacity: [0, 1, 1, 0], scale: 1.7 }}
            transition={{ duration: 1.8 }}
          >
            {r.emoji}
          </motion.span>
        ))}
      </div>
    </motion.article>
  );
}
function SparkleSpinner() {
  return <span className="judge-spinner">✳</span>;
}
