import type { BenchTask, MusicIR, MusicNote, ScoreBreakdown } from "./types";

const A_MINOR_PC = new Set([9, 11, 0, 2, 4, 5, 7]);
const DRUM_PITCHES = new Set([35, 36, 38, 40, 42, 44, 46, 49, 51]);

export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return JSON.parse(fence[1]!.trim());

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error("No JSON object found");
}

export function isMusicIR(value: unknown): value is MusicIR {
  const v = value as MusicIR;
  return !!v
    && typeof v.title === "string"
    && typeof v.bpm === "number"
    && typeof v.key === "string"
    && typeof v.meter === "string"
    && typeof v.bars === "number"
    && Array.isArray(v.style)
    && Array.isArray(v.sections)
    && Array.isArray(v.chordProgression)
    && Array.isArray(v.tracks);
}

export function scoreMusicIR(ir: MusicIR | null, task: BenchTask, parseOk: boolean): {
  score: number;
  breakdown: ScoreBreakdown;
  errors: string[];
} {
  const errors: string[] = [];
  const breakdown: ScoreBreakdown = {
    validJson: parseOk ? 10 : 0,
    schema: 0,
    promptFit: 0,
    theory: 0,
    arrangement: 0,
    rhythm: 0,
    editability: 0
  };

  if (!ir) {
    errors.push("Output was not a valid MusicIR object.");
    return { score: sum(breakdown), breakdown, errors };
  }

  breakdown.schema = scoreSchema(ir, errors);
  breakdown.promptFit = scorePromptFit(ir, task, errors);
  breakdown.theory = scoreTheory(ir, task, errors);
  breakdown.arrangement = scoreArrangement(ir, task, errors);
  breakdown.rhythm = scoreRhythm(ir, errors);
  breakdown.editability = scoreEditability(ir, task, errors);

  return { score: sum(breakdown), breakdown, errors };
}

function sum(b: ScoreBreakdown): number {
  return Math.round(Object.values(b).reduce((a, n) => a + n, 0) * 10) / 10;
}

function scoreSchema(ir: MusicIR, errors: string[]): number {
  let score = 10;
  if (ir.bars <= 0) score -= 2;
  if (!ir.sections.length) score -= 2;
  if (!ir.tracks.length) score -= 2;
  if (!ir.chordProgression.length) score -= 1;
  if (ir.tracks.some((t) => !t.name || !t.role)) score -= 1;
  if (ir.sections.some((s) => typeof s.startBar !== "number" || typeof s.bars !== "number")) score -= 1;
  if (score < 10) errors.push("Schema is incomplete or contains weak fields.");
  return clamp(score, 0, 10);
}

function scorePromptFit(ir: MusicIR, task: BenchTask, errors: string[]): number {
  let score = 10;
  if (Math.abs(ir.bpm - task.expected.bpm) > 2) {
    score -= 2;
    errors.push(`BPM mismatch: expected ${task.expected.bpm}, got ${ir.bpm}.`);
  }
  if (!norm(ir.key).includes(norm(task.expected.key))) {
    score -= 1.5;
    errors.push(`Key mismatch: expected ${task.expected.key}, got ${ir.key}.`);
  }
  const duration = (ir.bars * 4 * 60) / ir.bpm;
  const [minDur, maxDur] = task.expected.durationSec;
  if (duration < minDur || duration > maxDur) {
    score -= 2;
    errors.push(`Duration out of range: ${Math.round(duration)}s, expected ${minDur}-${maxDur}s.`);
  }
  const roles = new Set(ir.tracks.map((t) => t.role));
  for (const required of task.expected.requiredTracks) {
    if (!roles.has(required as never)) {
      score -= 1;
      errors.push(`Missing required role: ${required}.`);
    }
  }
  return clamp(score, 0, 10);
}

function scoreTheory(ir: MusicIR, task: BenchTask, errors: string[]): number {
  let pitched = 0;
  let inKey = 0;
  let playable = 0;
  for (const track of ir.tracks) {
    for (const note of track.notes ?? []) {
      if (track.role === "drums" && DRUM_PITCHES.has(note.pitch)) continue;
      pitched++;
      if (A_MINOR_PC.has(((note.pitch % 12) + 12) % 12)) inKey++;
      if (isPlayable(track.role, note)) playable++;
    }
  }
  if (pitched === 0) {
    errors.push("No pitched note data supplied.");
    return 4;
  }
  const keyScore = (inKey / pitched) * 7;
  const playableScore = (playable / pitched) * 3;
  const score = keyScore + playableScore;
  if (score < 8) errors.push("Pitched notes are weak on key fit or playable range.");
  return clamp(score, 0, 10);
}

function scoreArrangement(ir: MusicIR, task: BenchTask, errors: string[]): number {
  let score = 10;
  if (ir.sections.length < task.expected.minSections) {
    score -= 2;
    errors.push(`Too few sections: ${ir.sections.length}.`);
  }
  const [minSec, maxSec] = task.expected.sectionChangeEverySec;
  const sectionDurations = ir.sections.map((s) => (s.bars * 4 * 60) / ir.bpm);
  const goodDurations = sectionDurations.filter((d) => d >= minSec && d <= maxSec).length;
  if (goodDurations < Math.max(2, Math.floor(ir.sections.length * 0.6))) {
    score -= 2;
    errors.push("Section durations do not mostly land in the requested 20-30s window.");
  }
  const tracksWithChanges = ir.tracks.filter((t) => (t.changes?.length ?? 0) > 0).length;
  if (tracksWithChanges < 3) {
    score -= 2;
    errors.push("Not enough tracks describe arrangement changes.");
  }
  const sectionNames = new Set(ir.sections.map((s) => norm(s.name)));
  for (const important of ["intro", "verse", "chorus", "bridge", "outro"]) {
    if (![...sectionNames].some((name) => name.includes(important))) score -= 0.5;
  }
  return clamp(score, 0, 10);
}

function scoreRhythm(ir: MusicIR, errors: string[]): number {
  let notes = 0;
  let aligned = 0;
  let validDur = 0;
  for (const track of ir.tracks) {
    for (const note of track.notes ?? []) {
      notes++;
      if (Math.abs(note.start * 4 - Math.round(note.start * 4)) < 0.02) aligned++;
      if (note.duration > 0 && note.duration <= 16) validDur++;
    }
  }
  if (notes === 0) {
    errors.push("No note timing data supplied.");
    return 4;
  }
  const score = (aligned / notes) * 5 + (validDur / notes) * 5;
  if (score < 8) errors.push("Rhythm grid alignment or note durations are weak.");
  return clamp(score, 0, 10);
}

function scoreEditability(ir: MusicIR, task: BenchTask, errors: string[]): number {
  let score = 10;
  if (ir.tracks.some((t) => !t.name || t.name.length < 3)) score -= 2;
  if (ir.sections.some((s) => !s.role)) score -= 2;
  if (task.id.includes("revision") && (!ir.revisionNotes || ir.revisionNotes.length < 2)) {
    score -= 3;
    errors.push("Revision task did not include enough revisionNotes.");
  }
  if (!ir.mixNotes || ir.mixNotes.length < 2) score -= 1;
  return clamp(score, 0, 10);
}

function isPlayable(role: string, note: MusicNote): boolean {
  if (role === "bass") return note.pitch >= 28 && note.pitch <= 60;
  if (role === "guitar") return note.pitch >= 40 && note.pitch <= 88;
  if (role === "lead") return note.pitch >= 48 && note.pitch <= 96;
  if (role === "keys" || role === "pad") return note.pitch >= 36 && note.pitch <= 96;
  return note.pitch >= 0 && note.pitch <= 127;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
