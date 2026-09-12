import { Component, lazy, Suspense, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import Landing from './components/Landing';
import './styles.css';
const Battle = lazy(() => import('./components/Battle'));
class AppBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="missing-room">
        <h1>A quick mog pit reset.</h1>
        <p>Something interrupted this page. Your game state is saved on the server.</p>
        <button className="button primary" onClick={() => location.reload()}>
          Reconnect
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById('root')!).render(
  <AppBoundary>
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="missing-room">
              <span className="judge-spinner">✳</span>
              <h2>Opening the mog pit…</h2>
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/battle/:code" element={<Battle />} />
            <Route path="*" element={<Landing />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </MotionConfig>
  </AppBoundary>,
);
