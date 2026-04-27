export type ModelConfig = {
  name: string;
};

export type BenchTask = {
  id: string;
  title: string;
  prompt: string;
  expected: {
    bpm: number;
    durationSec: [number, number];
    key: string;
    requiredTracks: string[];
    minSections: number;
    sectionChangeEverySec: [number, number];
  };
};

export type MusicSection = {
  name: string;
  startBar: number;
  bars: number;
  role?: string;
};

export type MusicNote = {
  pitch: number;
  start: number;
  duration: number;
  velocity?: number;
};

export type MusicTrack = {
  name: string;
  role: "drums" | "bass" | "guitar" | "keys" | "pad" | "lead" | "fx" | "other";
  instrument?: string;
  notes?: MusicNote[];
  pattern?: string;
  changes?: string[];
};

export type MusicIR = {
  title: string;
  bpm: number;
  key: string;
  meter: string;
  bars: number;
  style: string[];
  sections: MusicSection[];
  chordProgression: string[];
  tracks: MusicTrack[];
  mixNotes?: string[];
  revisionNotes?: string[];
};

export type ScoreBreakdown = {
  validJson: number;
  schema: number;
  promptFit: number;
  theory: number;
  arrangement: number;
  rhythm: number;
  editability: number;
};

export type BenchResult = {
  model: string;
  taskId: string;
  score: number;
  breakdown: ScoreBreakdown;
  errors: string[];
  outputPath: string;
  rawPath: string;
};
