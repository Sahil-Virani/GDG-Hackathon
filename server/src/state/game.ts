import { randomBytes, randomUUID } from 'node:crypto';
import {
  breakdownSchema,
  judgeSchema,
  type Advice,
  type Breakdown,
  type ClosetItem,
  type GameEvent,
  type Judgment,
  type Phase,
  type RankedEntry,
  type RoomView,
  type PrivateView,
} from '../../../shared/schema.js';
export class GameError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export interface Submission {
  attemptCount: number;
  image?: string;
  finalized: boolean;
  judging: boolean;
  score?: number;
  breakdown?: Breakdown;
  feedback?: string;
  reason?: string;
  fallback?: boolean;
  advice?: Advice;
  advicePending?: Promise<Advice>;
}
export interface Player {
  id: string;
  token: string;
  name: string;
  connected: boolean;
  lastSeen: number;
  disconnectedByLease: boolean;
  connectionId?: string;
  camera: boolean;
  mic: boolean;
  closet: ClosetItem[];
  nextReady: boolean;
}
export interface Round {
  index: number;
  theme: string;
  type: 'practice' | 'final';
  submissions: Record<string, Submission>;
  leaderboard?: RankedEntry[];
  deadline?: number;
}
export interface Room {
  roomCode: string;
  sessionId?: string;
  hostParticipantId: string;
  phase: Phase;
  currentRoundIndex: number;
  rounds: Round[];
  participants: Map<string, Player>;
  createdAt: number;
  updatedAt: number;
  revision: number;
  phaseEndsAt?: number;
  showThemes: boolean;
}
export const neutral = (
  reason = 'Image quality prevented confident judging. A neutral score keeps you in the game.',
): Judgment => ({
  photo_suitable: true,
  reason_if_unsuitable: '',
  score: 5,
  feedback: reason,
  breakdown: { theme_relevance: 2, color_coordination: 1.5, fit_and_styling: 1.5 },
});
export function normalizeJudgment(input: unknown): Judgment {
  const result = judgeSchema.parse(input);
  if (!result.photo_suitable) return result;
  const b = breakdownSchema.parse(result.breakdown);
  return {
    ...result,
    breakdown: b,
    score: Math.round((b.theme_relevance + b.color_coordination + b.fit_and_styling) * 100) / 100,
    feedback: result.feedback.split(/\s+/).slice(0, 15).join(' '),
  };
}
export function rankRound(round: Round, players: Map<string, Player>): RankedEntry[] {
  const list = Object.entries(round.submissions)
    .filter(([, s]) => s.finalized && s.score !== undefined)
    .map(([id, s]) => ({
      participantId: id,
      name: players.get(id)?.name ?? 'Player',
      score: s.score!,
      breakdown: s.breakdown!,
      feedback: s.feedback!,
      hasImage: !!s.image,
      fallback: !!s.fallback,
      rank: 0,
    }));
  const compare = (a: RankedEntry, b: RankedEntry) =>
    b.score - a.score ||
    b.breakdown.theme_relevance - a.breakdown.theme_relevance ||
    b.breakdown.fit_and_styling - a.breakdown.fit_and_styling ||
    b.breakdown.color_coordination - a.breakdown.color_coordination;
  list.sort(compare);
  list.forEach((entry, i) => {
    entry.rank = i > 0 && compare(entry, list[i - 1]) === 0 ? list[i - 1].rank : i + 1;
  });
  return list;
}
export class GameStore {
  rooms = new Map<string, Room>();
  constructor(
    public emit: (room: Room, event: GameEvent) => void = () => {},
    public timeoutMs = 180_000,
  ) {}
  touch(room: Room, type: GameEvent['type'] = 'room_updated') {
    room.revision++;
    room.updatedAt = Date.now();
    this.emit(room, {
      type,
      roomCode: room.roomCode,
      revision: room.revision,
      roundIndex: room.currentRoundIndex,
    });
  }
  create(name: string, themes: string[], showThemes = true) {
    if (this.rooms.size >= 100) throw new GameError('The runway is full. Try again later.', 503);
    let code: string;
    do {
      code = `DRIP-${randomBytes(3).toString('hex').slice(0, 5).toUpperCase()}`;
    } while (this.rooms.has(code));
    const room: Room = {
      roomCode: code,
      hostParticipantId: '',
      phase: 'LOBBY',
      currentRoundIndex: 0,
      rounds: themes.map((theme, index) => ({
        index,
        theme,
        type: index === themes.length - 1 ? 'final' : 'practice',
        submissions: {},
      })),
      participants: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      revision: 0,
      showThemes,
    };
    this.rooms.set(code, room);
    const player = this.join(room, name);
    room.hostParticipantId = player.id;
    return { room, player };
  }
  get(code: string) {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new GameError('That room was not found. Check the invite code.', 404);
    return room;
  }
  join(room: Room, name: string) {
    if (room.phase !== 'LOBBY')
      throw new GameError(
        'This battle has started. Existing players can reconnect; new players can join the rematch.',
        409,
      );
    if (room.participants.size >= 8) throw new GameError('This battle is full (8 players).', 409);
    const player: Player = {
      id: randomUUID(),
      token: randomBytes(32).toString('hex'),
      name,
      connected: true,
      lastSeen: Date.now(),
      disconnectedByLease: false,
      camera: false,
      mic: false,
      closet: [],
      nextReady: false,
    };
    room.participants.set(player.id, player);
    this.touch(room);
    return player;
  }
  authenticate(room: Room, token?: string) {
    const p = [...room.participants.values()].find((p) => p.token === token);
    if (!p) throw new GameError('Your room session expired. Join the battle again.', 401);
    return p;
  }
  start(room: Room, p: Player) {
    if (p.id !== room.hostParticipantId)
      throw new GameError('Only the host can start the battle.', 403);
    if (room.phase !== 'LOBBY') throw new GameError('The battle already started.', 409);
    this.beginRound(room, 'round_started');
  }
  beginRound(room: Room, type: GameEvent['type']) {
    room.phase = 'THEME_REVEAL';
    room.phaseEndsAt = Date.now() + 3200;
    room.rounds[room.currentRoundIndex].deadline = room.phaseEndsAt + this.timeoutMs;
    for (const p of room.participants.values()) p.nextReady = false;
    this.touch(room, type);
  }
  submission(room: Room, p: Player) {
    const round = room.rounds[room.currentRoundIndex];
    return (round.submissions[p.id] ??= { attemptCount: 0, finalized: false, judging: false });
  }
  finalize(s: Submission, j: Judgment, fallback = false) {
    const result = normalizeJudgment(j);
    s.finalized = true;
    s.judging = false;
    s.score = result.score!;
    s.breakdown = breakdownSchema.parse(result.breakdown);
    s.feedback = result.feedback;
    s.fallback = fallback;
    s.reason = undefined;
  }
  async capture(
    room: Room,
    p: Player,
    index: number,
    image: string,
    judge: (image: string, theme: string) => Promise<Judgment & { fallback?: boolean }>,
  ) {
    if (index !== room.currentRoundIndex || room.phase !== 'POSE')
      throw new GameError('This round is no longer accepting captures.', 409);
    if (!p.connected) throw new GameError('Reconnect before submitting your look.', 409);
    const s = this.submission(room, p);
    if (s.finalized || s.judging)
      throw new GameError('Your look is already locked or being judged.', 409);
    if (s.attemptCount >= 3) throw new GameError('Your attempts are complete.', 409);
    s.attemptCount++;
    s.judging = true;
    s.image = image;
    this.touch(room);
    let result: Judgment & { fallback?: boolean };
    try {
      const judged = await judge(image, room.rounds[index].theme);
      result = { ...normalizeJudgment(judged), fallback: judged.fallback };
    } catch {
      result = {
        ...neutral('The AI judge is unavailable. You receive a neutral score for this round.'),
        fallback: true,
      };
    }
    // A deadline/disconnect can reveal the round while the network request is outstanding.
    if (room.currentRoundIndex !== index || room.phase !== 'POSE' || s.finalized) {
      s.judging = false;
      return;
    }
    s.judging = false;
    if (!result.photo_suitable && s.attemptCount < 3) {
      s.reason = result.reason_if_unsuitable || 'Please make the whole outfit clearly visible.';
      this.touch(room);
      return;
    }
    const fallback = !result.photo_suitable || result.fallback;
    this.finalize(s, result.photo_suitable ? result : neutral(), fallback);
    this.touch(room, 'participant_finalized');
    this.checkComplete(room);
  }
  checkComplete(room: Room) {
    if (room.phase !== 'POSE') return;
    const connected = [...room.participants.values()].filter((p) => p.connected);
    if (
      !connected.length ||
      !connected.every((p) => room.rounds[room.currentRoundIndex].submissions[p.id]?.finalized)
    )
      return;
    room.rounds[room.currentRoundIndex].leaderboard = rankRound(
      room.rounds[room.currentRoundIndex],
      room.participants,
    );
    room.phase = 'LEADERBOARD';
    room.phaseEndsAt = Date.now() + 4000;
    this.touch(room, 'leaderboard_reveal');
  }
  nextReady(room: Room, p: Player, index: number) {
    if (index !== room.currentRoundIndex || !['LEADERBOARD', 'ADVICE'].includes(room.phase))
      throw new GameError('Wait for the round reveal first.', 409);
    p.nextReady = true;
    this.touch(room);
    this.checkAdvance(room);
  }
  checkAdvance(room: Room) {
    if (!['LEADERBOARD', 'ADVICE'].includes(room.phase)) return;
    const connected = [...room.participants.values()].filter((p) => p.connected);
    if (!connected.length || !connected.every((p) => p.nextReady)) return;
    if (room.currentRoundIndex === room.rounds.length - 1) {
      room.phase = 'FINAL_RESULTS';
      room.phaseEndsAt = undefined;
      this.touch(room, 'final_results');
    } else {
      room.currentRoundIndex++;
      this.beginRound(room, 'round_advanced');
    }
  }
  heartbeat(room: Room, p: Player) {
    if (p.disconnectedByLease) this.connection(room, p, true);
    else p.lastSeen = Date.now();
  }
  connection(room: Room, p: Player, connected: boolean, connectionId?: string, expired = false) {
    const changed = p.connected !== connected || (connectionId && connectionId !== p.connectionId);
    p.connected = connected;
    p.disconnectedByLease = !connected && expired;
    p.lastSeen = Date.now();
    if (connectionId) p.connectionId = connectionId;
    if (!room.participants.get(room.hostParticipantId)?.connected) {
      const successor = [...room.participants.values()].find((p) => p.connected);
      if (successor) room.hostParticipantId = successor.id;
    }
    if (changed) this.touch(room);
    this.checkComplete(room);
    this.checkAdvance(room);
  }
  rematch(room: Room, p: Player) {
    if (p.id !== room.hostParticipantId || room.phase !== 'FINAL_RESULTS')
      throw new GameError('The host can start a rematch after the final results.', 403);
    room.currentRoundIndex = 0;
    room.phase = 'LOBBY';
    room.phaseEndsAt = undefined;
    room.rounds = room.rounds.map((r) => ({
      index: r.index,
      theme: r.theme,
      type: r.type,
      submissions: {},
    }));
    for (const p of room.participants.values()) p.nextReady = false;
    this.touch(room);
  }
  tick(now = Date.now()) {
    for (const room of this.rooms.values()) {
      for (const p of room.participants.values())
        if (p.connected && now - p.lastSeen > 35_000)
          this.connection(room, p, false, undefined, true);
      if (room.phase === 'THEME_REVEAL' && now >= (room.phaseEndsAt ?? Infinity)) {
        room.phase = 'POSE';
        room.phaseEndsAt = undefined;
        this.touch(room);
      }
      if (room.phase === 'LEADERBOARD' && now >= (room.phaseEndsAt ?? Infinity)) {
        room.phase = 'ADVICE';
        room.phaseEndsAt = undefined;
        this.touch(room);
      }
      const round = room.rounds[room.currentRoundIndex];
      if (room.phase === 'POSE' && now >= (round.deadline ?? Infinity)) {
        for (const p of room.participants.values())
          if (p.connected) {
            const s = this.submission(room, p);
            if (!s.finalized)
              this.finalize(
                s,
                neutral('The capture window ended. A neutral score keeps the battle moving.'),
                true,
              );
          }
        this.checkComplete(room);
      }
      if (now - room.updatedAt > 6 * 60 * 60 * 1000) this.rooms.delete(room.roomCode);
    }
  }
  view(room: Room, demo: boolean, videoEnabled: boolean): RoomView {
    const active = room.rounds[room.currentRoundIndex];
    return {
      roomCode: room.roomCode,
      hostParticipantId: room.hostParticipantId,
      phase: room.phase,
      totalRounds: room.rounds.length,
      currentRoundIndex: room.currentRoundIndex,
      revision: room.revision,
      phaseEndsAt: room.phaseEndsAt,
      createdAt: room.createdAt,
      demo,
      videoEnabled,
      rounds: room.rounds.map((r) => ({
        index: r.index,
        theme: room.showThemes || r.index <= room.currentRoundIndex ? r.theme : 'Surprise theme',
        type: r.type,
        deadline: r.deadline,
        leaderboard: r.leaderboard,
      })),
      participants: [...room.participants.values()].map((p) => ({
        id: p.id,
        name: p.name,
        connected: p.connected,
        connectionId: p.connectionId,
        camera: p.camera,
        mic: p.mic,
        closetCount: p.closet.length,
        nextReady: p.nextReady,
        status: active.submissions[p.id]?.finalized
          ? 'locked'
          : active.submissions[p.id]?.judging
            ? 'judging'
            : 'posing',
      })),
    };
  }
  privateView(room: Room, p: Player): PrivateView {
    const s = room.rounds[room.currentRoundIndex].submissions[p.id];
    return {
      attemptCount: s?.attemptCount ?? 0,
      reason: s?.reason,
      finalized: s?.finalized ?? false,
      hasImage: !!s?.image,
      advice: room.rounds[room.currentRoundIndex].leaderboard ? s?.advice : undefined,
      closet: p.closet.map(({ image: _, ...item }) => item),
    };
  }
}
