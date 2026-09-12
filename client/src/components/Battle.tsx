import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  ArrowUpRight,
  Camera,
  CameraOff,
  Check,
  Copy,
  Crown,
  DoorOpen,
  Link,
  Lock,
  Mic,
  MicOff,
  Play,
  ScanLine,
  Shirt,
  Sparkles,
  Upload,
  Users,
  X,
} from 'lucide-react';
import type { PrivateView, RoomView } from '../../../shared/schema';
import { api, captureFrame, compressImage, soundCue } from '../lib/api';
import { useSession } from '../stores/session';
import { useRoom } from '../hooks/useRoom';
import { useVideo } from '../hooks/useVideo';
import { usePose } from '../hooks/usePose';
import { Brand, Button, ErrorNotice } from './Primitives';
import { VideoTile } from './VideoTile';
import { Closet } from './Closet';
import { Stylist } from './Stylist';
import { Leaderboard } from './Leaderboard';
import { FinalResults } from './FinalResults';
const RunwayScene = lazy(() => import('./RunwayScene'));
export default function Battle() {
  const { code = '' } = useParams();
  const credentials = useSession((s) => s.credentials);
  const { room, mine, refresh, error } = useRoom(code);
  const navigate = useNavigate();
  if (!credentials || credentials.roomCode !== code)
    return (
      <div className="missing-room">
        <Brand />
        <h1>Your mog-off awaits.</h1>
        <p>Join this room to enter the mog-off.</p>
        <Button onClick={() => navigate(`/?join=${encodeURIComponent(code)}`)}>
          Join {code} <ArrowUpRight size={18} />
        </Button>
      </div>
    );
  if (!room || !mine)
    return (
      <div className="missing-room">
        <Brand />
        <span className="judge-spinner">✳</span>
        <h2>Opening the mog pit…</h2>
        <ErrorNotice message={error} retry={() => void refresh()} />
        <Button variant="secondary" onClick={() => navigate('/')}>
          Back to home
        </Button>
      </div>
    );
  return <BattleRoom room={room} mine={mine} refresh={refresh} networkError={error} />;
}
function BattleRoom({
  room,
  mine,
  refresh,
  networkError,
}: {
  room: RoomView;
  mine: PrivateView;
  refresh: () => Promise<void>;
  networkError: string;
}) {
  const credentials = useSession((s) => s.credentials)!;
  const navigate = useNavigate();
  const me = room.participants.find((p) => p.id === credentials.participantId)!;
  const isHost = room.hostParticipantId === me.id;
  const round = room.rounds[room.currentRoundIndex];
  const final = round.type === 'final';
  const lobby = room.phase === 'LOBBY';
  const revealed = !!round.leaderboard;
  const video = useVideo(room.roomCode, me.name, refresh);
  const [localVideo, setLocalVideo] = useState<HTMLVideoElement | null>(null);
  const pose = usePose(
    localVideo,
    room.phase === 'POSE' && !mine.finalized && me.status !== 'judging',
  );
  const [countdown, setCountdown] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [closet, setCloset] = useState(false);
  const [stylist, setStylist] = useState(false);
  const [copied, setCopied] = useState('');
  const [now, setNow] = useState(Date.now());
  const upload = useRef<HTMLInputElement>(null);
  const captureRef = useRef<() => void>(() => {});
  const phaseRef = useRef(room.phase);
  phaseRef.current = room.phase;
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    setCountdown(null);
    setError('');
    setStylist(false);
  }, [room.currentRoundIndex, lobby]);
  useEffect(() => {
    if (room.phase === 'ADVICE') setStylist(true);
    if (room.phase !== 'POSE') setCountdown(null);
    if (room.phase === 'LEADERBOARD') soundCue('reveal');
  }, [room.phase]);
  const sendCapture = useCallback(
    async (image: string) => {
      setBusy(true);
      setError('');
      soundCue('capture');
      try {
        await api(`/rooms/${room.roomCode}/rounds/${round.index}/capture`, { image });
        await refresh();
      } catch (e) {
        setError((e as Error).message);
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [room.roomCode, round.index, refresh],
  );
  captureRef.current = () => {
    if (phaseRef.current !== 'POSE') return;
    if (!video.camera || !localVideo) {
      setError('Your camera is unavailable. Retry camera access or upload a fit photo.');
      return;
    }
    try {
      void sendCapture(captureFrame(localVideo));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      captureRef.current();
      return;
    }
    soundCue('countdown');
    const t = setTimeout(() => setCountdown((n) => (n === null ? null : n - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown]);
  async function action(path: string) {
    setBusy(true);
    setError('');
    try {
      await api(`/rooms/${room.roomCode}/${path}`, {});
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function copy(value: string, type: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(type);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      setError(`Copy this invite: ${value}`);
    }
  }
  async function leave() {
    try {
      await api(`/rooms/${room.roomCode}/connection`, { connected: false });
    } catch {
      /* The server lease expires if offline. */
    }
    useSession.getState().setCredentials(null);
    navigate('/');
  }
  const connected = room.participants.filter((p) => p.connected);
  const waiting = connected.filter((p) => p.status !== 'locked');
  const readyCount = connected.filter((p) => p.nextReady).length;
  const remaining = Math.max(0, Math.ceil(((round.deadline ?? now) - now) / 1000));
  return (
    <div className={`battle-shell ${final && !lobby ? 'final-treatment' : ''}`}>
      <header className="site-header battle-header">
        <Brand />
        <div className="room-code">
          <span className="status-dot" />
          <span>{room.roomCode}</span>
          <button
            className="icon-button"
            aria-label="Copy room code"
            onClick={() => void copy(room.roomCode, 'code')}
          >
            {copied === 'code' ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
        <div className="header-actions">
          <span className="connection-label">
            <span className="status-dot" />
            {video.connection}
          </span>
          <button className="icon-button" onClick={() => void leave()} aria-label="Leave mog-off">
            <DoorOpen size={18} />
          </button>
        </div>
      </header>
      {room.demo && (
        <div className="demo-banner">
          <Sparkles size={12} /> DEMO MODE{' '}
          <span>
            Simulated AI scores & advice
            {!room.videoEnabled
              ? ' · Local camera only · Add Vonage credentials for multiplayer video'
              : ''}
          </span>
        </div>
      )}
      {room.phase === 'FINAL_RESULTS' ? (
        <>
          <ErrorNotice message={error} />
          <FinalResults
            room={room}
            isHost={isHost}
            rematch={() => void action('rematch')}
            home={() => void leave()}
          />
        </>
      ) : (
        <main className="battle-main">
          <div className="battle-title-row">
            <div>
              <span className={`eyebrow ${final && !lobby ? 'gold-text' : ''}`}>
                {lobby
                  ? 'THE PRE-MOG'
                  : final
                    ? 'FINAL ROUND · THIS ONE COUNTS.'
                    : `PRACTICE ROUND ${round.index + 1} OF ${room.totalRounds}`}
              </span>
              <h1>
                {lobby ? 'The crew is coming together.' : round.theme}
                <span className="title-sparkle">✳</span>
              </h1>
              <p>
                {lobby
                  ? 'Check your camera. Curate your closet. Get ready to show up.'
                  : revealed
                    ? 'The mogs are in. Time for a little feedback.'
                    : 'Find your frame. Bring your energy. Make this look yours.'}
              </p>
            </div>
            <div className="battle-tools">
              <Button variant="secondary" onClick={() => setCloset(true)}>
                <Shirt size={16} /> My closet{' '}
                <span className="count-pill">{mine.closet.length}</span>
              </Button>
              {lobby ? (
                <Button
                  variant="secondary"
                  onClick={() => void copy(`${location.origin}/?join=${room.roomCode}`, 'link')}
                >
                  {copied === 'link' ? <Check size={16} /> : <Link size={16} />}{' '}
                  {copied === 'link' ? 'Copied!' : 'Invite friends'}
                </Button>
              ) : revealed ? (
                <Button variant="secondary" onClick={() => setStylist((v) => !v)}>
                  <Sparkles size={16} /> My AI stylist
                </Button>
              ) : (
                <span className="round-timer">
                  {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}{' '}
                  <small>TO LOCK IN</small>
                </span>
              )}
            </div>
          </div>
          <div className="round-track">
            {room.rounds.map((r) => (
              <div
                key={r.index}
                className={`round-stop ${r.index === round.index ? 'active' : ''} ${r.type === 'final' ? 'is-final' : ''}`}
              >
                <span>
                  {r.index < round.index ? (
                    <Check size={12} />
                  ) : r.type === 'final' ? (
                    <Crown size={12} />
                  ) : (
                    String(r.index + 1).padStart(2, '0')
                  )}
                </span>
                <b>{r.theme}</b>
                <small>{r.type === 'final' ? 'FINAL' : 'PRACTICE'}</small>
              </div>
            ))}
          </div>
          <ErrorNotice message={networkError} retry={() => void refresh()} />
          <ErrorNotice message={error} />
          {video.error && <ErrorNotice message={video.error} retry={video.retry} />}
          <div className={`arena-layout ${stylist && revealed ? 'with-stylist' : ''}`}>
            <div className="arena-content">
              {revealed ? (
                <Leaderboard round={round} code={room.roomCode} participantId={me.id} />
              ) : (
                <>
                  <div className="arena-meta">
                    <span>
                      <RadioDot /> {lobby ? 'BACKSTAGE' : 'LIVE FIT CHECK'}
                    </span>
                    <span>
                      <Users size={13} /> {connected.length} / 8 PLAYERS
                    </span>
                  </div>
                  <div className={`video-grid players-${room.participants.length}`}>
                    {[me, ...room.participants.filter((p) => p.id !== me.id)].map((person) => (
                      <VideoTile
                        key={person.id}
                        person={person}
                        local={person.id === me.id}
                        stream={person.id === me.id ? video.stream : undefined}
                        remote={video.remote[person.id]}
                        session={video.session}
                        onVideo={person.id === me.id ? setLocalVideo : undefined}
                        guidance={
                          person.id === me.id && room.phase === 'POSE' ? pose.guidance : undefined
                        }
                        countdown={person.id === me.id ? countdown : undefined}
                        host={person.id === room.hostParticipantId}
                        code={room.roomCode}
                        roundIndex={round.index}
                        hasImage={person.id === me.id && mine.hasImage}
                        reactions={video.reactions.filter((r) => r.targetId === person.id)}
                        onReact={(emoji) => video.react(person.id, emoji)}
                      />
                    ))}
                    {lobby && room.participants.length === 1 && (
                      <button
                        className="invite-tile"
                        onClick={() =>
                          void copy(`${location.origin}/?join=${room.roomCode}`, 'link')
                        }
                      >
                        <div className="lobby-scene">
                          <Suspense fallback={null}>
                            <RunwayScene />
                          </Suspense>
                        </div>
                        <span className="invite-tile-copy">
                          <span className="invite-plus">+</span>
                          <h3>A mog-off is better with friends.</h3>
                          <p>Send the invite. Start the friendly rivalry.</p>
                          <span>
                            {copied === 'link' ? 'INVITE COPIED' : 'COPY INVITE LINK'}{' '}
                            <ArrowUpRight size={15} />
                          </span>
                        </span>
                      </button>
                    )}
                  </div>
                </>
              )}
              <div className="arena-action-bar">
                <div className="media-controls">
                  <button
                    className={`icon-button ${!video.mic ? 'off' : ''}`}
                    aria-label={video.mic ? 'Mute microphone' : 'Unmute microphone'}
                    onClick={video.toggleMic}
                  >
                    {video.mic ? <Mic size={19} /> : <MicOff size={19} />}
                  </button>
                  <button
                    className={`icon-button ${!video.camera ? 'off' : ''}`}
                    aria-label={video.camera ? 'Turn camera off' : 'Turn camera on'}
                    onClick={video.toggleCamera}
                  >
                    {video.camera ? <Camera size={19} /> : <CameraOff size={19} />}
                  </button>
                </div>
                <div className="action-caption">
                  {lobby ? (
                    <>
                      <span className="status-dot" />
                      <span>
                        {isHost ? 'Your room. Your rules.' : 'Waiting for the host to start.'}
                      </span>
                    </>
                  ) : revealed ? (
                    <>
                      <Check size={16} />
                      <span>
                        {readyCount} / {connected.length} players{' '}
                        {final ? 'ready to see who mogs' : 'ready for next round'}
                      </span>
                    </>
                  ) : mine.finalized ? (
                    <>
                      <Lock size={16} />
                      <span>
                        <b>Look locked.</b> Waiting for{' '}
                        {waiting.map((p) => p.name).join(', ') || 'the reveal'}…
                      </span>
                    </>
                  ) : (
                    <>
                      <ScanLine size={16} />
                      <span>
                        {countdown !== null
                          ? 'Get into frame — your photo is coming up.'
                          : me.status === 'judging' || busy
                            ? 'Your look is with the judge.'
                            : 'Click Ready, then use 7 seconds to get into frame.'}
                      </span>
                    </>
                  )}
                </div>
                {lobby ? (
                  <Button disabled={!isHost || busy} onClick={() => void action('start')}>
                    {isHost ? 'Start the mog-off' : 'Waiting for host'}
                    <Play size={16} />
                  </Button>
                ) : revealed ? (
                  <Button
                    variant={final ? 'gold' : 'primary'}
                    disabled={busy || me.nextReady}
                    onClick={() => void action(`rounds/${round.index}/next-ready`)}
                  >
                    {me.nextReady ? (
                      <>
                        <Check size={16} /> Locked in
                      </>
                    ) : final ? (
                      <>
                        Reveal who mogs <Crown size={16} />
                      </>
                    ) : (
                      <>
                        Ready for next round <ArrowRight size={16} />
                      </>
                    )}
                  </Button>
                ) : mine.finalized ? (
                  <span className="locked-chip">
                    <Lock size={14} /> LOOK LOCKED
                  </span>
                ) : countdown !== null ? (
                  <Button variant="secondary" onClick={() => setCountdown(null)}>
                    Cancel countdown <X size={15} />
                  </Button>
                ) : (
                  <Button
                    disabled={
                      busy ||
                      me.status === 'judging' ||
                      room.phase !== 'POSE' ||
                      !video.camera ||
                      !localVideo
                    }
                    onClick={() => {
                      setError('');
                      soundCue('ready');
                      setCountdown(7);
                    }}
                  >
                    Ready · 7s capture <ArrowRight size={16} />
                  </Button>
                )}
              </div>
              {!lobby && !revealed && !mine.finalized && (
                <div className="capture-extras">
                  {mine.reason && (
                    <div className="retry-notice">
                      <b>AI Judge wants another look.</b>
                      <span>Let’s try that again — {mine.reason}</span>
                    </div>
                  )}
                  <span>
                    ATTEMPT {Math.min(3, mine.attemptCount + 1)} / 3 · CLOTHING ONLY, ALWAYS.
                  </span>
                  <button
                    disabled={
                      busy || me.status === 'judging' || room.phase !== 'POSE' || countdown !== null
                    }
                    onClick={() => upload.current?.click()}
                  >
                    <Upload size={13} /> Upload a fit photo
                  </button>
                  <input
                    ref={upload}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file)
                        void compressImage(file)
                          .then(sendCapture)
                          .catch((e) => setError(e.message));
                      e.target.value = '';
                    }}
                  />
                </div>
              )}
              {lobby && (
                <div className="lobby-tip">
                  <Sparkles size={19} />
                  <div>
                    <b>A little prep goes a long way.</b>
                    <span>
                      Add a few pieces to your closet for personalized advice. Practice rounds are
                      for experimenting — only the final decides who mogs.
                    </span>
                  </div>
                </div>
              )}
            </div>
            {stylist && revealed && (
              <Stylist
                key={round.index}
                code={room.roomCode}
                index={round.index}
                onClose={() => setStylist(false)}
              />
            )}
          </div>
        </main>
      )}
      <footer className="battle-footer">
        <span>GOOD FITS. GOOD ENERGY.</span>
        <span>
          <Lock size={11} /> PRIVATE ROOM · {room.totalRounds} ROUNDS · FINAL SCORES ONLY
        </span>
      </footer>
      <AnimatePresence>
        {room.phase === 'THEME_REVEAL' && (
          <motion.div
            className={`theme-reveal ${final ? 'gold-reveal' : ''}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="theme-reveal-scene">
              <Suspense fallback={null}>
                <RunwayScene podium={final} />
              </Suspense>
            </div>
            <div className="theme-reveal-orbit" />
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
            >
              <span className="eyebrow">
                {final
                  ? 'FINAL ROUND · THIS ONE COUNTS.'
                  : round.index === 0
                    ? 'YOUR FIRST CHALLENGE'
                    : 'NEXT CHALLENGE'}
              </span>
              <h1>{round.theme}</h1>
              <p>
                {final
                  ? 'Practice is over. Time to mog.'
                  : 'New theme. Fresh start. Make it yours.'}
              </p>
              <b className="theme-count">
                {Math.max(1, Math.ceil(((room.phaseEndsAt ?? now) - now) / 1000))}
              </b>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {closet && (
        <Closet
          code={room.roomCode}
          mine={mine}
          refresh={refresh}
          onClose={() => setCloset(false)}
        />
      )}
    </div>
  );
}
function RadioDot() {
  return <span className="status-dot" />;
}
