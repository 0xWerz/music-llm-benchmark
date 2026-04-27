import type { BenchTask } from "./types";

const musicIrInstructions = `
Return only JSON. Do not use markdown.
Create exactly this MusicIR shape:
{
  "title": string,
  "bpm": number,
  "key": string,
  "meter": "4/4",
  "bars": number,
  "style": string[],
  "sections": [{"name": string, "startBar": number, "bars": number, "role": string}],
  "chordProgression": string[],
  "tracks": [{"name": string, "role": "drums"|"bass"|"guitar"|"keys"|"pad"|"lead"|"fx"|"other", "instrument": string, "notes": [{"pitch": number, "start": number, "duration": number, "velocity": number}], "changes": string[]}],
  "mixNotes": string[],
  "revisionNotes": string[]
}
Do not use keys named type, note, dur, vel, endBar, durationBars, or bars as a string range.
Use MIDI note numbers for pitch. Note start and duration are in beats from the beginning.
Keep it compact: 6 sections, 5 tracks, max 6 notes per pitched track, max 12 notes for drums.
The music should be original, not a copy of any existing song.
Make it editable: name sections and tracks clearly, include changes arrays for arrangement intent.
`;

export const tasks: BenchTask[] = [
  {
    id: "dream-pop-arrangement",
    title: "Dream Pop Arrangement Validity",
    prompt: `${musicIrInstructions}
Write a 90-110 second original dream pop / indie electronica / lo-fi hip hop arrangement.
Constraints:
- 136 BPM, 4/4, A minor.
- Guitar-centered, warm and clean, no harsh static noise.
- Sections should change smoothly every 20-30 seconds.
- Include drums, bass, guitar, pad, and lead/keys.
- The guitar motif can repeat, but it must not feel like one identical loop forever.
- Add a clear intro, verse, chorus, bridge/drop, second chorus, outro.
- Keep parts playable and musically coherent.`,
    expected: {
      bpm: 136,
      durationSec: [90, 110],
      key: "A minor",
      requiredTracks: ["drums", "bass", "guitar", "pad", "lead"],
      minSections: 5,
      sectionChangeEverySec: [20, 30]
    }
  },
  {
    id: "revision-repair",
    title: "Revision Repair After Critique",
    prompt: `${musicIrInstructions}
You previously made a track where the intro guitar sounded good, but after 15 seconds it either looped forever or used broken inconsistent chops.
Revise it.
Constraints:
- 136 BPM, 4/4, A minor.
- Preserve a clean, warm guitar identity.
- No hard sample glitches, no rhythmic breaks, no random unrelated guitar loops.
- Every 20-30 seconds something important should change smoothly: density, rhythm, register, instrumentation, or section role.
- Include drums, bass, guitar, pad, and lead/keys.
- Add revisionNotes explaining what changed and how the critique was fixed.`,
    expected: {
      bpm: 136,
      durationSec: [90, 120],
      key: "A minor",
      requiredTracks: ["drums", "bass", "guitar", "pad", "lead"],
      minSections: 5,
      sectionChangeEverySec: [20, 30]
    }
  }
];
