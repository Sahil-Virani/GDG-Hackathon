import express, { type NextFunction, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createSchema, closetSchema, imageSchema, nameSchema } from '../../shared/schema.js';
import { config } from './config.js';
import { GameStore, GameError, type Player, type Room } from './state/game.js';
import { broadcast, credentials } from './services/video.js';
import { coach, judge, tryOn } from './services/ai.js';
export const store = new GameStore(broadcast, config.ROUND_TIMEOUT_SECONDS * 1000);
export const app = express();
app.disable('x-powered-by');
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
app.use(express.json({ limit: '2mb' }));
const windows = new Map<string, { at: number; count: number }>();
app.use('/api', (req, res, next) => {
  const key = req.ip ?? 'local';
  let entry = windows.get(key);
  if (!entry || Date.now() - entry.at > 60000) {
    entry = { at: Date.now(), count: 0 };
    windows.set(key, entry);
  }
  if (++entry.count > 1200) {
    res.status(429).json({ error: 'A little too much runway traffic. Try again in a moment.' });
    return;
  }
  next();
});
export function cleanupLimits() {
  for (const [key, value] of windows) if (Date.now() - value.at > 60000) windows.delete(key);
}
const auth = (req: Request): { room: Room; player: Player } => {
  const room = store.get(String(req.params.code));
  return {
    room,
    player: store.authenticate(room, req.headers.authorization?.replace(/^Bearer /, '')),
  };
};
const roundIndex = (req: Request) => z.coerce.number().int().min(0).max(4).parse(req.params.index);
const publicResponse = (room: Room, player: Player) => ({
  room: store.view(room, config.demo, config.videoEnabled),
  mine: store.privateView(room, player),
});
app.get('/api/config', (_req, res) =>
  res.json({ demo: config.demo, videoEnabled: config.videoEnabled }),
);
app.post('/api/rooms', (req, res) => {
  const body = createSchema.parse(req.body);
  const { room, player } = store.create(body.name, body.themes, body.showThemes);
  res
    .status(201)
    .json({ roomCode: room.roomCode, participantId: player.id, accessToken: player.token });
});
app.post('/api/rooms/:code/join', (req, res) => {
  const { name } = z.object({ name: nameSchema }).parse(req.body);
  const room = store.get(String(req.params.code));
  const player = store.join(room, name);
  res
    .status(201)
    .json({ roomCode: room.roomCode, participantId: player.id, accessToken: player.token });
});
app.get('/api/rooms/:code/state', (req, res) => {
  const { room, player } = auth(req);
  res.json(publicResponse(room, player));
});
app.post('/api/rooms/:code/video', async (req, res) => {
  const { room, player } = auth(req);
  res.json({ video: await credentials(room, player) });
});
app.post('/api/rooms/:code/start', (req, res) => {
  const { room, player } = auth(req);
  store.start(room, player);
  res.json(publicResponse(room, player));
});
app.post('/api/rooms/:code/heartbeat', (req, res) => {
  const { room, player } = auth(req);
  store.heartbeat(room, player);
  res.json({ ok: true });
});
app.post('/api/rooms/:code/connection', (req, res) => {
  const { connected, connectionId, camera, mic } = z
    .object({
      connected: z.boolean(),
      connectionId: z.string().max(150).optional(),
      camera: z.boolean().optional(),
      mic: z.boolean().optional(),
    })
    .parse(req.body);
  const { room, player } = auth(req);
  if (camera !== undefined) player.camera = camera;
  if (mic !== undefined) player.mic = mic;
  store.connection(room, player, connected, connectionId);
  if (camera !== undefined || mic !== undefined) store.touch(room);
  res.json({ ok: true });
});
app.post('/api/rooms/:code/closet', (req, res) => {
  const body = closetSchema.parse(req.body);
  const { room, player } = auth(req);
  if (player.closet.length >= 12)
    throw new GameError('Your closet holds up to 12 pieces. Remove a piece to make room.');
  const item = { ...body, id: randomUUID() };
  player.closet.push(item);
  store.touch(room);
  res.status(201).json({ id: item.id });
});
app.delete('/api/rooms/:code/closet/:id', (req, res) => {
  const { room, player } = auth(req);
  player.closet = player.closet.filter((i) => i.id !== String(req.params.id));
  store.touch(room);
  res.json({ ok: true });
});
app.post('/api/rooms/:code/rounds/:index/capture', async (req, res) => {
  const { image } = z.object({ image: imageSchema }).parse(req.body);
  const { room, player } = auth(req);
  await store.capture(room, player, roundIndex(req), image, judge);
  res.json(publicResponse(room, player));
});
app.post('/api/rooms/:code/rounds/:index/advice', async (req, res) => {
  const { room, player } = auth(req);
  const round = room.rounds[roundIndex(req)];
  if (!round?.leaderboard)
    throw new GameError('Advice unlocks after everyone has been judged.', 409);
  const s = round.submissions[player.id];
  if (!s?.finalized) {
    res.json({ advice: null });
    return;
  }
  if (!s.advice) {
    s.advicePending ??= coach(s, round.theme, player.closet);
    s.advice = await s.advicePending;
    s.advicePending = undefined;
  }
  res.json({ advice: s.advice });
});
app.post('/api/rooms/:code/rounds/:index/next-ready', (req, res) => {
  const { room, player } = auth(req);
  store.nextReady(room, player, roundIndex(req));
  res.json(publicResponse(room, player));
});
app.post('/api/rooms/:code/rematch', (req, res) => {
  const { room, player } = auth(req);
  store.rematch(room, player);
  res.json(publicResponse(room, player));
});
app.get('/api/rooms/:code/media/:kind/:id', (req, res) => {
  const { room, player } = auth(req);
  let image: string | undefined;
  if (req.params.kind === 'closet')
    image = player.closet.find((i) => i.id === req.params.id)?.image;
  else if (req.params.kind === 'capture') {
    const index = z.coerce.number().int().min(0).max(4).parse(req.query.round);
    const round = room.rounds[index];
    if (round && (round.leaderboard || req.params.id === player.id))
      image = round.submissions[String(req.params.id)]?.image;
  }
  if (!image) throw new GameError('This image is not available.', 404);
  const [prefix, data] = image.split(',');
  res.type(prefix.slice(5).split(';')[0]).send(Buffer.from(data, 'base64'));
});
const previews = new Set<string>();
app.post('/api/rooms/:code/try-on', async (req, res) => {
  const { itemId, index } = z
    .object({ itemId: z.string(), index: z.number().int().min(0).max(4) })
    .parse(req.body);
  const { room, player } = auth(req);
  const item = player.closet.find((i) => i.id === itemId);
  const round = room.rounds[index];
  const submission = round?.submissions[player.id];
  if (!item || !submission?.image || !round.leaderboard)
    throw new GameError('Choose a closet recommendation after your round reveal.');
  if (!submission.advice?.suggestions.some((s) => s.closet_item_id === itemId))
    throw new GameError('Choose a piece recommended by your stylist.');
  if (previews.has(player.id)) throw new GameError('Your preview is already on its way.', 429);
  previews.add(player.id);
  try {
    res.json(await tryOn(submission.image, item));
  } finally {
    previews.delete(player.id);
  }
});
app.use('/api', (_req, res) =>
  res.status(404).json({ error: 'That runway action was not found.' }),
);
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) {
    res
      .status(400)
      .json({ error: error.issues[0]?.message ?? 'Please check the submitted fields.' });
    return;
  }
  if (error instanceof GameError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  const status = (error as { status?: number })?.status;
  if (status === 413) {
    res.status(413).json({ error: 'That image is too large. Please choose a smaller photo.' });
    return;
  }
  if (status === 400) {
    res.status(400).json({ error: 'Please send a valid request.' });
    return;
  }
  console.error('Request failed:', error instanceof Error ? error.name : 'UnknownError');
  res
    .status(503)
    .json({ error: 'The runway service is temporarily unavailable. Please try again.' });
});
