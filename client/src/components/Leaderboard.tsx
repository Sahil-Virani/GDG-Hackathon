import { lazy, Suspense } from 'react';
import { Crown, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import type { PublicRound } from '../../../shared/schema';
import { ProtectedImage, Score } from './Primitives';
const RunwayScene = lazy(() => import('./RunwayScene'));
export function Leaderboard({
  round,
  code,
  participantId,
}: {
  round: PublicRound;
  code: string;
  participantId: string;
}) {
  return (
    <div className="leaderboard">
      <div className="reveal-heading">
        <div className="leaderboard-atmosphere">
          <Suspense fallback={null}>
            <RunwayScene />
          </Suspense>
        </div>
        <span className="eyebrow">
          <Sparkles size={13} /> THE JUDGE HAS SPOKEN
        </span>
        <h2>
          {round.type === 'final' ? 'The final fit check.' : 'A little practice. A lot of mog.'}
        </h2>
        <p>
          {round.type === 'final'
            ? 'These are the only scores that count toward the mog.'
            : 'Fresh round, fresh scores. Take the feedback into your next look.'}
        </p>
      </div>
      <div className="leaderboard-list">
        {round.leaderboard?.map((entry, i) => (
          <motion.article
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.18 }}
            key={entry.participantId}
            className={`leaderboard-entry ${entry.rank === 1 ? 'leader' : ''}`}
          >
            <div className="rank-number">
              {entry.rank === 1 ? <Crown size={23} /> : String(entry.rank).padStart(2, '0')}
            </div>
            <div className="leader-photo">
              {entry.hasImage ? (
                <ProtectedImage
                  path={`/rooms/${code}/media/capture/${entry.participantId}?round=${round.index}`}
                  alt={`${entry.name}'s outfit`}
                />
              ) : (
                <span>{entry.name.charAt(0)}</span>
              )}
            </div>
            <div className="leader-detail">
              <h3>
                {entry.name} {entry.participantId === participantId && <small>YOU</small>}
                {round.leaderboard!.filter((e) => e.rank === entry.rank).length > 1 && (
                  <small>TIED</small>
                )}
              </h3>
              <p>{entry.feedback}</p>
              <div className="rubric">
                <span>
                  THEME <b>{entry.breakdown.theme_relevance}/4</b>
                </span>
                <span>
                  COLOR <b>{entry.breakdown.color_coordination}/3</b>
                </span>
                <span>
                  STYLING <b>{entry.breakdown.fit_and_styling}/3</b>
                </span>
                {entry.fallback && <span>NEUTRAL FALLBACK</span>}
              </div>
            </div>
            <div className="leader-score">
              <Score value={entry.score} />
              <small>/ 10</small>
            </div>
          </motion.article>
        ))}
      </div>
    </div>
  );
}
