import { z } from 'zod';
export const themes = [
  'Streetwear',
  'Date Night',
  'Business Casual',
  'Y2K',
  'Red Carpet',
  'Airport Fit',
  'Quiet Luxury',
  'Monochrome',
] as const;
export const nameSchema = z.string().trim().min(1).max(24);
export const imageSchema = z
  .string()
  .max(2_000_000)
  .regex(
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/,
    'Choose a JPEG, PNG, or WebP image under 1.5 MB.',
  );
export const createSchema = z.object({
  name: nameSchema,
  themes: z.array(z.string().trim().min(1).max(60)).min(1).max(5),
  showThemes: z.boolean().default(true),
});
export const closetSchema = z.object({
  image: imageSchema,
  category: z.enum(['Top', 'Bottom', 'Shoes', 'Outerwear', 'Accessory', 'Other']),
  label: z.string().trim().max(60).default(''),
});
export const breakdownSchema = z.object({
  theme_relevance: z.number().min(0).max(4),
  color_coordination: z.number().min(0).max(3),
  fit_and_styling: z.number().min(0).max(3),
});
export const judgeSchema = z.object({
  photo_suitable: z.boolean(),
  reason_if_unsuitable: z.string().max(400),
  score: z.number().min(0).max(10).nullable(),
  feedback: z.string().max(400),
  breakdown: z.object({
    theme_relevance: z.number().min(0).max(4).nullable(),
    color_coordination: z.number().min(0).max(3).nullable(),
    fit_and_styling: z.number().min(0).max(3).nullable(),
  }),
});
export const adviceSchema = z.object({
  headline: z.string().max(150),
  what_worked: z.string().max(500),
  biggest_upgrade: z.string().max(500),
  suggestions: z
    .array(
      z.object({
        text: z.string().max(300),
        closet_item_id: z.string().nullable(),
        reason: z.string().max(300),
      }),
    )
    .max(3),
});
export const eventSchema = z.object({
  type: z.enum([
    'room_updated',
    'round_started',
    'participant_finalized',
    'leaderboard_reveal',
    'round_advanced',
    'final_results',
  ]),
  roomCode: z.string(),
  revision: z.number().int(),
  roundIndex: z.number().int(),
});
export const reactionSchema = z.object({
  type: z.literal('reaction'),
  targetId: z.string().max(80),
  emoji: z.enum(['🔥', '👑', '😭', '💀', '✨']),
});
export type Breakdown = z.infer<typeof breakdownSchema>;
export type Judgment = z.infer<typeof judgeSchema>;
export type Advice = z.infer<typeof adviceSchema>;
export type GameEvent = z.infer<typeof eventSchema>;
export type ClosetItem = z.infer<typeof closetSchema> & { id: string };
export type Phase = 'LOBBY' | 'THEME_REVEAL' | 'POSE' | 'LEADERBOARD' | 'ADVICE' | 'FINAL_RESULTS';
export type Status = 'posing' | 'judging' | 'locked';
export interface PublicParticipant {
  id: string;
  name: string;
  connected: boolean;
  connectionId?: string;
  camera: boolean;
  mic: boolean;
  closetCount: number;
  status: Status;
  nextReady: boolean;
}
export interface RankedEntry {
  participantId: string;
  name: string;
  rank: number;
  score: number;
  breakdown: Breakdown;
  feedback: string;
  hasImage: boolean;
  fallback: boolean;
}
export interface PublicRound {
  index: number;
  theme: string;
  type: 'practice' | 'final';
  leaderboard?: RankedEntry[];
  deadline?: number;
}
export interface RoomView {
  roomCode: string;
  hostParticipantId: string;
  phase: Phase;
  totalRounds: number;
  currentRoundIndex: number;
  rounds: PublicRound[];
  participants: PublicParticipant[];
  revision: number;
  phaseEndsAt?: number;
  demo: boolean;
  videoEnabled: boolean;
  createdAt: number;
}
export interface PrivateView {
  attemptCount: number;
  reason?: string;
  finalized: boolean;
  hasImage: boolean;
  advice?: Advice;
  closet: Omit<ClosetItem, 'image'>[];
}
export interface Credentials {
  participantId: string;
  accessToken: string;
  roomCode: string;
}
export interface VideoCredentials {
  applicationId: string;
  sessionId: string;
  token: string;
}
