import { lazy, Suspense, useEffect } from 'react';
import { Crown, RotateCcw, ArrowUpRight } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import confetti from 'canvas-confetti';
import type { RoomView } from '../../../shared/schema';
import { Button, ProtectedImage } from './Primitives';
import { soundCue } from '../lib/api';
const RunwayScene = lazy(() => import('./RunwayScene'));
export function FinalResults({
  room,
  isHost,
  rematch,
  home,
}: {
  room: RoomView;
  isHost: boolean;
  rematch: () => void;
  home: () => void;
}) {
  const reduced = useReducedMotion();
  const final = room.rounds[room.rounds.length - 1];
  const winners = final.leaderboard?.filter((e) => e.rank === 1) ?? [];
  useEffect(() => {
    soundCue('winner');
    if (reduced) return;
    const t = setTimeout(
      () =>
        void confetti({
          particleCount: 130,
          spread: 100,
          origin: { y: 0.55 },
          colors: ['#afffdf', '#f0ce94', '#ffffff'],
          disableForReducedMotion: true,
        }),
      2200,
    );
    return () => clearTimeout(t);
  }, [reduced]);
  return (
    <section className="final-results">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <span className="eyebrow gold-text">THE FINAL MOG. THE LAST WORD.</span>
        <h1>{winners.length > 1 ? 'Share the spotlight.' : 'Consider the room mogged.'}</h1>
        <p>WHO MOGS WHO {winners.length > 1 ? 'CO-MOGGERS' : 'CHAMPION MOGGER'}</p>
      </motion.div>
      <div className="podium-scene">
        <Suspense fallback={<div className="scene-fallback" />}>
          <RunwayScene podium />
        </Suspense>
        <div className="winner-cards">
          {winners.map((w) => (
            <motion.div
              key={w.participantId}
              className="winner-card"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.7, duration: 0.8 }}
            >
              <Crown className="winner-crown" size={36} />
              {w.hasImage ? (
                <ProtectedImage
                  path={`/rooms/${room.roomCode}/media/capture/${w.participantId}?round=${final.index}`}
                  alt={`${w.name}'s winning outfit`}
                />
              ) : (
                <div className="winner-avatar">{w.name.charAt(0)}</div>
              )}
              <div>
                <h2>{w.name}</h2>
                <strong>
                  {w.score.toFixed(1)}
                  <small> / 10</small>
                </strong>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      <div className="podium-runners">
        {final.leaderboard
          ?.filter((e) => e.rank > 1)
          .slice(0, 2)
          .map((e, i) => (
            <motion.div
              key={e.participantId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: e.rank === 3 ? 0.5 : 1 }}
            >
              <span>#{e.rank}</span>
              <b>{e.name}</b>
              <span>{e.score.toFixed(1)}</span>
            </motion.div>
          ))}
      </div>
      <p className="final-note">Final round only · {final.theme} · Practice was for the glow-up.</p>
      <div className="final-actions">
        <Button variant="gold" disabled={!isHost} onClick={rematch}>
          <RotateCcw size={16} />
          {isHost ? 'Rematch' : 'Waiting for host rematch'}
        </Button>
        <Button variant="secondary" onClick={home}>
          Back to home <ArrowUpRight size={16} />
        </Button>
      </div>
    </section>
  );
}
