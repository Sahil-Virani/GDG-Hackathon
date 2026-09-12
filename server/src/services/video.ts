import { readFileSync } from 'node:fs';
import { Vonage } from '@vonage/server-sdk';
import { MediaMode } from '@vonage/video';
import { config } from '../config.js';
import { eventSchema, type GameEvent, type VideoCredentials } from '../../../shared/schema.js';
import type { Player, Room } from '../state/game.js';
const vonage = config.videoEnabled
  ? new Vonage({
      applicationId: config.VONAGE_APPLICATION_ID,
      privateKey: readFileSync(config.VONAGE_PRIVATE_KEY_PATH, 'utf8'),
    })
  : undefined;
const pending = new Map<string, Promise<string>>();
export async function credentials(room: Room, player: Player): Promise<VideoCredentials | null> {
  if (!vonage) return null;
  if (!room.sessionId) {
    let promise = pending.get(room.roomCode);
    if (!promise) {
      promise = vonage.video
        .createSession({ mediaMode: MediaMode.ROUTED })
        .then((s) => s.sessionId);
      pending.set(room.roomCode, promise);
    }
    try {
      room.sessionId = await promise;
    } finally {
      pending.delete(room.roomCode);
    }
  }
  return {
    applicationId: config.VONAGE_APPLICATION_ID,
    sessionId: room.sessionId,
    token: vonage.video.generateClientToken(room.sessionId, {
      role: 'publisher',
      data: JSON.stringify({ participantId: player.id }),
      expireTime: Math.floor(Date.now() / 1000) + 6 * 60 * 60,
    }),
  };
}
export function broadcast(room: Room, event: GameEvent) {
  if (!vonage || !room.sessionId) return;
  void vonage.video
    .sendSignal({ type: 'battle', data: JSON.stringify(eventSchema.parse(event)) }, room.sessionId)
    .catch(() =>
      console.warn('Signal delivery failed; clients will recover from the state endpoint.'),
    );
}
