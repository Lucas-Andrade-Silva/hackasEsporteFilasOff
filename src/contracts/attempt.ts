export type Sport = "volleyball" | "basketball";
export type AttemptStatus = "accepted" | "experimental" | "rejected";
export type Landmark = { x: number; y: number; confidence: number; estimated: boolean };
export type PoseFrame = {
  timestampMs: number; width: number; height: number; athleteCount: number;
  landmarks: Record<string, Landmark>;
};
export type Measurement = {
  protocolId: string; protocolVersion: string; algorithmVersion: string;
  sport: Sport; metric: "jump_height" | "squat_repetitions";
  unit: "cm" | "repetitions"; value: number | null;
  uncertainty: number | null; uncertaintyMethod: string | null;
  status: AttemptStatus; effectiveFps: number | null; qualityFlags: string[];
  events: { name: "takeoff" | "apex" | "landing"; timestampMs: number }[];
};
export interface ExerciseProtocol {
  id: string; version: string;
  evaluate(frames: PoseFrame[]): Measurement;
}
export type AttemptSource = "synthetic_video" | "synthetic_pose_replay" | "authorized_capture";
export type AttemptEvidence = {
  schemaVersion: string; sessionId: string; challengeId: string; protocolId: string;
  protocolVersion: string; algorithmVersion: string; source: AttemptSource;
  fixtureId?: string; idempotencyKey: string; frames: PoseFrame[];
};
export type AttemptResponse = {
  attemptId: string; measurement: Measurement; rankingEligible: boolean;
  verificationLevel: "recorded" | "engine_checked";
};
export type DemoAttempt = {
  id: string; fixtureId: string; createdAt: string; measurement: Measurement;
  rankingEligible: boolean; source: "synthetic_pose_replay";
};
export type DemoRequest = { fixtureId: string; idempotencyKey: string };
export type DemoState = { persistence: "local" | "supabase"; attempts: DemoAttempt[] };
