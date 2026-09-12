import test from 'node:test';
import assert from 'node:assert/strict';
import { GameStore, normalizeJudgment, type Room, type Player } from '../server/src/state/game';
import { judgeWithRetry } from '../server/src/services/judging';
import { framing } from '../client/src/lib/pose';
import type { Judgment } from '../shared/schema';
const image = 'data:image/jpeg;base64,/9j/2Q==';
const judged = (theme: number, color: number, styling: number): Judgment => ({
  photo_suitable: true,
  reason_if_unsuitable: '',
  score: 0,
  feedback: 'A considered palette and thoughtful layers.',
  breakdown: { theme_relevance: theme, color_coordination: color, fit_and_styling: styling },
});
const good = judged(3, 2, 2);
const unsuitable: Judgment = {
  photo_suitable: false,
  reason_if_unsuitable: 'Your shoes are outside the frame.',
  score: null,
  feedback: '',
  breakdown: { theme_relevance: null, color_coordination: null, fit_and_styling: null },
};
function setup(themes = ['Streetwear', 'Monochrome', 'Red Carpet']) {
  const store = new GameStore();
  const { room, player: host } = store.create('Host', themes);
  const guest = store.join(room, 'Guest');
  store.start(room, host);
  store.tick(Date.now() + 3300);
  return { store, room, host, guest };
}
async function capture(store: GameStore, room: Room, p: Player, result = good) {
  await store.capture(room, p, room.currentRoundIndex, image, async () => result);
}
test('scores normalize to rubric sum and malformed suitable scores reject', () => {
  assert.equal(normalizeJudgment(judged(4, 3, 2)).score, 9);
  assert.throws(() =>
    normalizeJudgment({ ...good, breakdown: { ...good.breakdown, theme_relevance: null } }),
  );
});
test('individual score and private image are never in state before the reveal', async () => {
  const { store, room, host } = setup();
  await capture(store, room, host);
  const view = store.view(room, true, false);
  assert.equal(view.phase, 'POSE');
  assert.equal(view.rounds[0].leaderboard, undefined);
  assert.equal(JSON.stringify(view).includes('"score"'), false);
  assert.equal(JSON.stringify(store.privateView(room, host)).includes('"score"'), false);
  assert.equal(store.privateView(room, host).finalized, true);
});
test('three unsuitable captures terminate with a neutral 5 and retain attempt limit', async () => {
  const { store, room, host } = setup();
  for (let i = 1; i <= 3; i++) {
    await capture(store, room, host, unsuitable);
    assert.equal(store.submission(room, host).attemptCount, i);
    assert.equal(store.submission(room, host).finalized, i === 3);
  }
  assert.equal(store.submission(room, host).score, 5);
  assert.equal(store.submission(room, host).fallback, true);
  await assert.rejects(capture(store, room, host));
});
test('malformed Gemini and provider errors retry once then safely fall back', async () => {
  for (const value of [null, { score: 10 }, '```json nope']) {
    let attempts = 0;
    const result = await judgeWithRetry(async () => {
      attempts++;
      return value;
    });
    assert.equal(attempts, 2);
    assert.equal(result.score, 5);
    assert.equal(result.fallback, true);
  }
  let attempts = 0;
  const recovered = await judgeWithRetry(async () => {
    if (++attempts === 1) throw new Error('network');
    return good;
  });
  assert.equal(recovered.score, 7);
  assert.equal(attempts, 2);
});
test('provider failure is finalized and never stalls remaining players', async () => {
  const { store, room, host, guest } = setup();
  await store.capture(room, host, 0, image, async () => {
    throw new Error('provider failure');
  });
  await capture(store, room, guest);
  assert.equal(room.phase, 'LEADERBOARD');
  assert.equal(room.rounds[0].submissions[host.id].score, 5);
});
test('disconnected players do not block completion and host transfers', async () => {
  const { store, room, host, guest } = setup();
  await capture(store, room, guest);
  store.connection(room, host, false);
  assert.equal(room.phase, 'LEADERBOARD');
  assert.equal(room.hostParticipantId, guest.id);
  store.nextReady(room, guest, 0);
  assert.equal(room.currentRoundIndex, 1);
});
test('round advancement clears readiness, attempts and active scores; final ignores practice', async () => {
  const { store, room, host, guest } = setup();
  for (let i = 0; i < 3; i++) {
    await capture(store, room, host, i === 2 ? judged(1, 1, 1) : judged(4, 3, 3));
    await capture(store, room, guest, i === 2 ? judged(3, 2, 2) : judged(1, 1, 1));
    assert.equal(room.phase, 'LEADERBOARD');
    store.nextReady(room, host, i);
    store.nextReady(room, guest, i);
    if (i < 2) {
      assert.equal(room.currentRoundIndex, i + 1);
      assert.equal(host.nextReady, false);
      assert.equal(store.privateView(room, host).attemptCount, 0);
      assert.deepEqual(room.rounds[i + 1].submissions, {});
      store.tick(Date.now() + 3300);
    }
  }
  assert.equal(room.phase, 'FINAL_RESULTS');
  assert.equal(room.rounds[0].leaderboard![0].participantId, host.id);
  assert.equal(room.rounds[2].leaderboard![0].participantId, guest.id);
  assert.equal(room.rounds[2].leaderboard![0].score, 7);
});
test('equal rubric scores are co-winners; tied totals compare theme then styling then color', async () => {
  let { store, room, host, guest } = setup(['Final']);
  await capture(store, room, host, judged(3, 2, 2));
  await capture(store, room, guest, judged(3, 2, 2));
  assert.deepEqual(
    room.rounds[0].leaderboard!.map((e) => e.rank),
    [1, 1],
  );
  ({ store, room, host, guest } = setup(['Final']));
  await capture(store, room, host, judged(3, 3, 1));
  await capture(store, room, guest, judged(4, 1, 2));
  assert.equal(room.rounds[0].leaderboard![0].participantId, guest.id);
  ({ store, room, host, guest } = setup(['Final']));
  await capture(store, room, host, judged(3, 3, 1));
  await capture(store, room, guest, judged(3, 2, 2));
  assert.equal(room.rounds[0].leaderboard![0].participantId, guest.id);
});
test('authority rejects non-host start, stale round submissions and early readiness', async () => {
  const store = new GameStore();
  const { room, player } = store.create('Host', ['Final']);
  const guest = store.join(room, 'Guest');
  assert.throws(() => store.start(room, guest));
  assert.throws(() => store.nextReady(room, guest, 0));
  await assert.rejects(store.capture(room, guest, 0, image, async () => good));
  store.start(room, player);
  store.tick(Date.now() + 3300);
  await assert.rejects(store.capture(room, guest, 1, image, async () => good));
});
test('concurrent double capture cannot spend multiple attempts', async () => {
  const { store, room, host } = setup();
  let resolve!: (j: Judgment) => void;
  const first = store.capture(room, host, 0, image, () => new Promise((r) => (resolve = r)));
  await assert.rejects(capture(store, room, host));
  assert.equal(store.submission(room, host).attemptCount, 1);
  resolve(good);
  await first;
});
test('late AI response cannot overwrite deadline fallback or old round', async () => {
  const { store, room, host, guest } = setup();
  let resolve!: (j: Judgment) => void;
  const pending = store.capture(room, host, 0, image, () => new Promise((r) => (resolve = r)));
  const now = room.rounds[0].deadline! + 1;
  host.lastSeen = now;
  guest.lastSeen = now;
  store.tick(now);
  assert.equal(room.phase, 'LEADERBOARD');
  assert.equal(room.rounds[0].submissions[host.id].score, 5);
  resolve(judged(4, 3, 3));
  await pending;
  assert.equal(room.rounds[0].submissions[host.id].score, 5);
});
test('reconnect retains locked submission without exposing individual score', async () => {
  const { store, room, host, guest } = setup();
  await capture(store, room, host);
  store.connection(room, host, false);
  store.connection(room, host, true);
  assert.equal(store.privateView(room, host).finalized, true);
  assert.equal(room.phase, 'POSE');
  await capture(store, room, guest);
  assert.equal(room.phase, 'LEADERBOARD');
});
test('presence lease expires and excludes an abandoned player', async () => {
  const { store, room, host, guest } = setup();
  await capture(store, room, host);
  const now = Date.now() + 36000;
  host.lastSeen = now;
  store.tick(now);
  assert.equal(guest.connected, false);
  assert.ok(room.rounds[0].leaderboard);
  assert.ok(['LEADERBOARD', 'ADVICE'].includes(room.phase));
});
test('closet and advice never leak to another participant', async () => {
  const { store, room, host, guest } = setup();
  host.closet.push({ id: 'secret', image, category: 'Top', label: 'Private shirt' });
  await capture(store, room, host);
  store.submission(room, host).advice = {
    headline: 'Private advice',
    what_worked: 'Private',
    biggest_upgrade: 'Private',
    suggestions: [],
  };
  assert.equal(JSON.stringify(store.view(room, true, false)).includes('Private'), false);
  assert.equal(store.privateView(room, guest).closet.length, 0);
  assert.equal(store.privateView(room, host).advice, undefined);
});
test('rematch retains closet but resets all rounds and results', async () => {
  const { store, room, host, guest } = setup(['Final']);
  await capture(store, room, host);
  await capture(store, room, guest);
  store.nextReady(room, host, 0);
  store.nextReady(room, guest, 0);
  store.rematch(room, host);
  assert.equal(room.phase, 'LOBBY');
  assert.equal(room.rounds[0].leaderboard, undefined);
  assert.deepEqual(room.rounds[0].submissions, {});
});
test('pose framing requires visible shoulders, hips, knees and shoes and centered distance', () => {
  const p = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
  p[0].y = 0.12;
  p[27].y = 0.9;
  p[28].y = 0.9;
  assert.equal(framing(p).valid, true);
  p[28].visibility = 0;
  assert.equal(framing(p).valid, false);
  p[28].visibility = 1;
  for (const i of [11, 12, 23, 24]) p[i].x = 0.8;
  assert.equal(framing(p).direction, 'right');
});

test('heartbeat recovers an expired lease without undoing an explicit disconnect', () => {
  const { store, room, host, guest } = setup();
  const now = Date.now() + 36_000;
  host.lastSeen = now;
  store.tick(now);
  assert.equal(guest.connected, false);
  assert.equal(guest.disconnectedByLease, true);
  store.heartbeat(room, guest);
  assert.equal(guest.connected, true);
  store.connection(room, guest, false);
  store.heartbeat(room, guest);
  assert.equal(guest.connected, false);
});
