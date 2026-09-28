export type Pin = {
  readonly n: number;
  readonly left: number;
  readonly top: number;
};

export type Caption = {
  readonly text: string;
  readonly isMobile: boolean;
};

export type Figure = {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly mobileWidth: number;
  readonly mobileHeight: number;
  readonly alt: string;
  readonly pins: readonly Pin[];
  readonly mobilePins: readonly Pin[];
  readonly captions: readonly Caption[];
};

export const S01: Figure = {
  id: 'S01',
  width: 1800,
  height: 900,
  mobileWidth: 576,
  mobileHeight: 222,
  alt: 'The Harborline board: eleven sessions across building, running, needs you and in review, with the webhook fix in review on pull request 318 at $3.47',
  pins: [
    { n: 1, left: 76.13, top: 29.1 },
    { n: 2, left: 79.38, top: 28.03 },
  ],
  mobilePins: [
    { n: 1, left: 55.82, top: 61.71 },
    { n: 2, left: 73.29, top: 62.49 },
  ],
  captions: [
    { text: 'The pull request the task opened', isMobile: true },
    { text: 'What the task has cost so far', isMobile: true },
  ],
};

export const S04: Figure = {
  id: 'S04',
  width: 1800,
  height: 731,
  mobileWidth: 1032,
  mobileHeight: 635,
  alt: 'An orchestrated run on the webhook fix waiting on step 4, with the hint box, Queue and Read now, and a hint that waits for the next decision',
  pins: [
    { n: 1, left: 51.53, top: 32.88 },
    { n: 2, left: 38.88, top: 59.02 },
  ],
  mobilePins: [
    { n: 1, left: 6.02, top: 8.15 },
    { n: 2, left: 31.81, top: 92.32 },
  ],
  captions: [
    { text: 'The step running now, with its own model', isMobile: true },
    { text: 'Your hint, waiting for the next decision', isMobile: true },
  ],
};

export const S03: Figure = {
  id: 'S03',
  width: 1800,
  height: 1491,
  mobileWidth: 766,
  mobileHeight: 78,
  alt: 'A session overview with its projects, a suggestion to answer an open question, and the Activity timeline with a queued step at about 11 to 14 minutes',
  pins: [
    { n: 1, left: 15.04, top: 79.57 },
    { n: 2, left: 38.84, top: 75.55 },
  ],
  mobilePins: [{ n: 1, left: 3.71, top: 50.0 }],
  captions: [
    { text: 'The one move that unblocks the task, here a question', isMobile: true },
    { text: 'The next step, queued with a rough time', isMobile: false },
  ],
};

export const S08: Figure = {
  id: 'S08',
  width: 1800,
  height: 1125,
  mobileWidth: 1032,
  mobileHeight: 790,
  alt: 'The brief as it was sent to Codex, next to the Context drawer where decision 3 replaced decision 1 with its reason',
  pins: [
    { n: 1, left: 95.02, top: 21.83 },
    { n: 2, left: 89.63, top: 40.78 },
    { n: 3, left: 32.8, top: 66.22 },
  ],
  mobilePins: [
    { n: 1, left: 87.75, top: 7.28 },
    { n: 2, left: 65.55, top: 70.9 },
  ],
  captions: [
    { text: 'Decision 3, and the one it replaced', isMobile: true },
    { text: 'The replaced decision keeps its reason', isMobile: true },
    { text: 'The exact text Codex received', isMobile: false },
  ],
};

export const S13: Figure = {
  id: 'S13',
  width: 1800,
  height: 1125,
  mobileWidth: 948,
  mobileHeight: 201,
  alt: 'Wireframe compare for the deliveries screen, v2 to v3, where v3 adds a stuck delivery banner and an attempts column',
  pins: [
    { n: 1, left: 75.69, top: 37.89 },
    { n: 2, left: 83.54, top: 51.22 },
  ],
  mobilePins: [
    { n: 1, left: 95.57, top: 27.61 },
    { n: 2, left: 96.29, top: 72.39 },
  ],
  captions: [
    { text: 'v3 adds a banner for a stuck delivery', isMobile: true },
    { text: 'and a column with the attempts per event', isMobile: true },
  ],
};

export const S14: Figure = {
  id: 'S14',
  width: 1800,
  height: 1620,
  mobileWidth: 1014,
  mobileHeight: 1314,
  alt: 'The session report: Retried webhooks no longer double credit, with what was wrong, where it came from and what changed',
  pins: [
    { n: 1, left: 47.47, top: 5.94 },
    { n: 2, left: 22.32, top: 19.94 },
  ],
  mobilePins: [
    { n: 1, left: 77.53, top: 8.79 },
    { n: 2, left: 6.1, top: 48.78 },
  ],
  captions: [
    { text: 'Where it came from: the agents and the plan behind it', isMobile: true },
    { text: 'What the session did, in plain words', isMobile: true },
  ],
};

export const S04r: Figure = {
  id: 'S04r',
  width: 1800,
  height: 612,
  mobileWidth: 939,
  mobileHeight: 423,
  alt: 'Workflow steps by role, scouts, a planner, implementers and a tester, each with its own model and cost, the planner at $1.28 and a scout at $0.02',
  pins: [
    { n: 1, left: 93.26, top: 42.54 },
    { n: 2, left: 93.26, top: 74.78 },
  ],
  mobilePins: [
    { n: 1, left: 93.28, top: 11.7 },
    { n: 2, left: 93.93, top: 88.3 },
  ],
  captions: [
    { text: 'The planner, the step that costs the most', isMobile: true },
    { text: 'A scout, for two cents', isMobile: true },
  ],
};

export const S10: Figure = {
  id: 'S10',
  width: 1800,
  height: 582,
  mobileWidth: 801,
  mobileHeight: 360,
  alt: 'The projects of one session: payments-api with pull request 318 in review and 311 merged, notify-relay with pull request 57 in review',
  pins: [
    { n: 1, left: 76.98, top: 33.44 },
    { n: 2, left: 76.32, top: 70.94 },
  ],
  mobilePins: [
    { n: 1, left: 96.29, top: 15.83 },
    { n: 2, left: 93.83, top: 84.17 },
  ],
  captions: [
    { text: 'The branch this session opened, in review as #318', isMobile: true },
    { text: 'A second branch in notify-relay, in review as #57', isMobile: true },
  ],
};

export const S16: Figure = {
  id: 'S16',
  width: 1800,
  height: 623,
  mobileWidth: 795,
  mobileHeight: 237,
  alt: 'The top bar with Claude out until 14:20, above the Codex usage page with 41% and 58% used and one free reset',
  pins: [
    { n: 1, left: 12.05, top: 72.33 },
    { n: 2, left: 14.31, top: 92.56 },
    { n: 3, left: 58.36, top: 52.54 },
  ],
  mobilePins: [{ n: 3, left: 68.5, top: 24.68 }],
  captions: [
    { text: 'A free Codex reset, and when it expires', isMobile: false },
    { text: 'What Goodboy spent on Codex today', isMobile: false },
    { text: 'How much of the 5-hour window and the week is used', isMobile: true },
  ],
};

export const S19: Figure = {
  id: 'S19',
  width: 1800,
  height: 1125,
  mobileWidth: 888,
  mobileHeight: 917,
  alt: 'The Inbox with HBL-412 pasted in the search and found outside the inbox, open on the right with Launch session',
  pins: [
    { n: 1, left: 79.14, top: 14.06 },
    { n: 2, left: 85.3, top: 43.29 },
  ],
  mobilePins: [
    { n: 1, left: 31.9, top: 5.4 },
    { n: 2, left: 61.88, top: 91.49 },
  ],
  captions: [
    { text: 'HBL-412, found from a code pasted in search', isMobile: true },
    { text: 'One press starts a session with the brief drafted', isMobile: true },
  ],
};

export const S12: Figure = {
  id: 'S12',
  width: 1800,
  height: 1352,
  mobileWidth: 1011,
  mobileHeight: 615,
  alt: 'Seven review comments on pull request 318 grouped by file, one fixed in commit 4f21c8b and several replies ready to review',
  pins: [
    { n: 1, left: 27.53, top: 65.95 },
    { n: 2, left: 29.07, top: 80.41 },
  ],
  mobilePins: [
    { n: 1, left: 75.48, top: 40.0 },
    { n: 2, left: 80.0, top: 92.2 },
  ],
  captions: [
    { text: 'The fix, committed', isMobile: true },
    { text: 'A reply drafted in your voice, waiting for you', isMobile: true },
  ],
};

export const S25: Figure = {
  id: 'S25',
  width: 1800,
  height: 642,
  mobileWidth: 1011,
  mobileHeight: 627,
  alt: 'Working copies of old sessions with what each weighs, 5.0 GB in all, and one button to remove the three that are safe',
  pins: [
    { n: 1, left: 52.06, top: 41.3 },
    { n: 2, left: 3.39, top: 85.64 },
  ],
  mobilePins: [
    { n: 1, left: 82.69, top: 11.72 },
    { n: 2, left: 4.07, top: 88.52 },
  ],
  captions: [
    { text: 'What each working copy weighs', isMobile: true },
    { text: 'Clears the three that are safe, in one go', isMobile: true },
  ],
};

export const S26: Figure = {
  id: 'S26',
  width: 1800,
  height: 174,
  mobileWidth: 942,
  mobileHeight: 411,
  alt: 'A saved script that looks like it contains a token, with Not a secret',
  pins: [
    { n: 1, left: 20.72, top: 50.0 },
    { n: 2, left: 86.58, top: 34.74 },
  ],
  mobilePins: [
    { n: 1, left: 62.47, top: 42.7 },
    { n: 2, left: 7.31, top: 79.56 },
  ],
  captions: [
    { text: 'The token, masked, in a saved script', isMobile: true },
    { text: 'Dismiss it when it is not a secret', isMobile: true },
  ],
};
