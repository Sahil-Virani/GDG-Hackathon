import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Users,
  Sparkles,
  Radio,
  ChevronRight,
  Crown,
  ScanLine,
  Plus,
  Minus,
  Check,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { themes, type Credentials } from '../../../shared/schema';
import { api } from '../lib/api';
import { useSession } from '../stores/session';
import { Brand, Button, ErrorNotice, Modal } from './Primitives';
import { FitIllustration } from './FitIllustration';
const RunwayScene = lazy(() => import('./RunwayScene'));
export default function Landing() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'create' | 'join' | null>(params.has('join') ? 'join' : null);
  const [name, setName] = useState('');
  const [code, setCode] = useState(params.get('join') ?? '');
  const [roundThemes, setRoundThemes] = useState<string[]>([
    'Streetwear',
    'Date Night',
    'Red Carpet',
  ]);
  const [showThemes, setShowThemes] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [config, setConfig] = useState<{ demo: boolean; videoEnabled: boolean } | null>(null);
  const navigate = useNavigate();
  const setCredentials = useSession((s) => s.setCredentials);
  useEffect(() => {
    void api<{ demo: boolean; videoEnabled: boolean }>('/config')
      .then(setConfig)
      .catch(() => {});
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api<Credentials>(
        mode === 'create' ? '/rooms' : `/rooms/${code.trim().toUpperCase()}/join`,
        mode === 'create' ? { name, themes: roundThemes, showThemes } : { name },
      );
      setCredentials(data);
      navigate(`/battle/${data.roomCode}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="landing">
      <header className="site-header">
        <Brand />
        <nav>
          <a href="#how-it-works">How it works</a>
          <a href="#the-rules">
            The rules <ArrowUpRight size={13} />
          </a>
          <Button variant="secondary" onClick={() => setMode('join')}>
            Join a battle <ArrowUpRight size={15} />
          </Button>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <motion.div
              className="eyebrow live-label"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <span className="status-dot" /> YOUR GROUP CHAT. UPGRADED.
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65 }}
            >
              Good friends.
              <br />
              Great fits.
              <br />
              <span>One winner.</span>
              <span className="heading-star">✳</span>
            </motion.h1>
            <p className="hero-description">
              Turn your camera on. Bring your best look.
              <br />
              Battle your friends in a live fashion showdown,
              <br className="desktop-br" /> with an AI judge calling the shots.
            </p>
            <div className="hero-actions">
              <Button onClick={() => setMode('create')}>
                Create battle <ArrowUpRight size={20} />
              </Button>
              <Button variant="secondary" onClick={() => setMode('join')}>
                Join battle <ArrowRight size={18} />
              </Button>
            </div>
            <div className="hero-fineprint">
              <span>
                <Users size={14} /> 2–8 friends
              </span>
              <i />
              <span>No downloads</span>
              <i />
              <span>Just good taste</span>
            </div>
            <div className="tech-caption">
              <span>THE TECH BEHIND THE TASTE</span>
              <b>
                <Sparkles size={16} /> Gemini
              </b>
              <b className="vonage-word">▰ Vonage</b>
            </div>
          </div>
          <motion.div
            className="hero-stage"
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.8 }}
          >
            <div className="stage-grid" />
            <div className="hero-3d">
              <Suspense fallback={null}>
                <RunwayScene />
              </Suspense>
            </div>
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <span className="stage-coordinate">LIVE FROM YOUR LIVING ROOM</span>
            <div className="example-card back-card">
              <div className="example-card-top">
                <span className="status-dot" /> CHALLENGER 02 <span>◈</span>
              </div>
              <FitIllustration variant={1} />
              <div className="example-name">
                THE EVERYDAY EDIT <small>EFFORTLESS, ALWAYS.</small>
              </div>
            </div>
            <div className="example-card front-card">
              <div className="example-card-top">
                <span className="status-dot" /> LOOK LOCKED <ScanLine size={16} />
              </div>
              <FitIllustration />
              <div className="example-name">
                OFF-DUTY ENERGY <small>STREETWEAR / LOOK 01</small>
              </div>
              <div className="fit-score">
                <span>AI JUDGE</span>
                <strong>
                  9.2<small>/10</small>
                </strong>
                <div>THE DETAILS? DELIVERED.</div>
              </div>
            </div>
            <div className="floating-theme">
              <Sparkles size={17} />
              <div>
                <small>THE THEME IS</small>
                <strong>Streetwear</strong>
              </div>
              <span>01 / 03</span>
            </div>
            <div className="floating-reaction">
              🔥 <span>Okay, we see you.</span>
            </div>
            <div className="stage-note">
              <span className="tiny-line" /> FIT CHECK IN PROGRESS <span>✦</span>
            </div>
            <div className="illustration-label">ILLUSTRATED LOOKS · SAMPLE SCORE</div>
          </motion.div>
        </section>
        <div className="runway-ticker">
          <span>BRING THE LOOK</span>
          <span>✳</span>
          <span>FEEL THE HYPE</span>
          <span>✳</span>
          <span>OWN THE RUNWAY</span>
          <span>✳</span>
          <span>BRING THE LOOK</span>
          <span>✳</span>
          <span>FEEL THE HYPE</span>
        </div>
        <section className="how-section" id="how-it-works">
          <div className="section-heading">
            <div>
              <span className="eyebrow">FROM GROUP CHAT TO MAIN CHARACTER</span>
              <h2>Less scrolling. More showing up.</h2>
            </div>
            <p>
              A little competition.
              <br />A lot of outfit inspiration.
            </p>
          </div>
          <div className="steps-grid">
            {[
              {
                n: '01',
                icon: Users,
                title: 'Round up your people.',
                text: 'Create a room, pick your themes, and drop the invite in the group chat.',
                tag: 'YOUR PRIVATE RUNWAY',
              },
              {
                n: '02',
                icon: ScanLine,
                title: 'Put your fit to the test.',
                text: 'Step into frame. Our AI judge scores the outfit and gives you tips to level up.',
                tag: 'GOOD TASTE MEETS GEMINI',
              },
              {
                n: '03',
                icon: Crown,
                title: 'Make the final count.',
                text: 'Practice is for experimenting. The final round is for taking the crown.',
                tag: 'ONE FINAL. ALL THE GLORY.',
              },
            ].map((s) => (
              <div className="step-card" key={s.n}>
                <div className="step-top">
                  <s.icon size={23} />
                  <span>{s.n}</span>
                </div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
                <span className="step-tag">
                  {s.tag} <ChevronRight size={13} />
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="rules-strip" id="the-rules">
          <div className="rules-icon">
            <Sparkles />
          </div>
          <div>
            <h3>We judge the outfit. Keep the energy kind.</h3>
            <p>
              Theme relevance · Color coordination · Fit & styling. Practice scores reset. Only the
              final decides the winner.
            </p>
          </div>
          <span className="outline-tag">STYLE IS FOR EVERYONE</span>
        </section>
      </main>
      <footer>
        <Brand />
        <span>MADE FOR THE FIT CHECK GENERATION.</span>
        <small>
          {config?.demo
            ? 'DEMO MODE · SIMULATED AI'
            : config
              ? 'LIVE AI EXPERIENCE'
              : 'CONNECTING TO THE RUNWAY'}
        </small>
      </footer>
      {mode && (
        <Modal
          title={mode === 'create' ? 'Set the stage.' : 'Your people are waiting.'}
          onClose={() => {
            setMode(null);
            setError('');
          }}
        >
          <form onSubmit={submit}>
            <label>
              Your display name
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What should we call you?"
                required
                maxLength={24}
              />
            </label>
            {mode === 'join' ? (
              <label>
                Room code
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="DRIP-XXXXX"
                  required
                  maxLength={12}
                />
              </label>
            ) : (
              <>
                <div className="round-control">
                  <span>
                    Number of rounds<small>The last round decides the winner.</small>
                  </span>
                  <div>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Fewer rounds"
                      disabled={roundThemes.length === 1}
                      onClick={() => setRoundThemes((v) => v.slice(0, -1))}
                    >
                      <Minus size={16} />
                    </button>
                    <b>{roundThemes.length}</b>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="More rounds"
                      disabled={roundThemes.length === 5}
                      onClick={() =>
                        setRoundThemes((v) => [...v, themes[v.length % themes.length]])
                      }
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                <div className="theme-inputs">
                  {roundThemes.map((theme, i) => (
                    <label key={i}>
                      <span>
                        ROUND {i + 1} <em>{i === roundThemes.length - 1 ? 'FINAL' : 'PRACTICE'}</em>
                      </span>
                      <select
                        value={theme}
                        onChange={(e) =>
                          setRoundThemes((v) => v.map((t, j) => (i === j ? e.target.value : t)))
                        }
                      >
                        {themes.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={showThemes}
                    onChange={(e) => setShowThemes(e.target.checked)}
                  />
                  Show upcoming themes in the lobby
                </label>
              </>
            )}
            {config?.demo && (
              <div className="demo-note">
                <Sparkles size={15} />
                <span>
                  Demo mode: simulated judging & coaching.
                  {!config.videoEnabled ? ' Local camera only until Vonage is configured.' : ''}
                </span>
              </div>
            )}
            <ErrorNotice message={error} />
            <Button className="full-width" disabled={busy}>
              {busy ? 'Opening the runway…' : mode === 'create' ? 'Create battle' : 'Join battle'}
              {busy ? <span className="spinner" /> : <ArrowUpRight size={18} />}
            </Button>
            <p className="form-note">
              <Check size={12} /> Camera stays in the room. Only your capture goes to the judge.
            </p>
          </form>
        </Modal>
      )}
    </div>
  );
}
