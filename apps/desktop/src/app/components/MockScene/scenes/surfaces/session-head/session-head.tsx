import type { ComponentType } from 'react';
import { BoardShellScene } from '../../BoardShellScene';
import { sessionHeadSeed } from './sessionHeadSeed';

const OVERVIEW = sessionHeadSeed({ lens: null });
const OVERVIEW_LIGHT = sessionHeadSeed({ lens: null, theme: 'light' });
const RUNS = sessionHeadSeed({ lens: 'workflows' });
const ARTIFACTS = sessionHeadSeed({ lens: 'plans' });
const QUESTIONS = sessionHeadSeed({ lens: 'questions' });
const CONTEXT = sessionHeadSeed({ lens: 'context' });
const BRANCH = sessionHeadSeed({ lens: null, isBranch: true });
const BRANCH_LIGHT = sessionHeadSeed({ lens: null, isBranch: true, theme: 'light' });

export const SESSION_HEAD_SCENES = {
  'session-head-overview': () => <BoardShellScene afterSeed={OVERVIEW} isSessionOpen />,
  'session-head-overview-light': () => <BoardShellScene afterSeed={OVERVIEW_LIGHT} isSessionOpen />,
  'session-head-runs': () => <BoardShellScene afterSeed={RUNS} isSessionOpen />,
  'session-head-artifacts': () => <BoardShellScene afterSeed={ARTIFACTS} isSessionOpen />,
  'session-head-questions': () => <BoardShellScene afterSeed={QUESTIONS} isSessionOpen />,
  'session-head-context': () => <BoardShellScene afterSeed={CONTEXT} isSessionOpen />,
  'session-head-branch': () => <BoardShellScene afterSeed={BRANCH} isSessionOpen />,
  'session-head-branch-light': () => <BoardShellScene afterSeed={BRANCH_LIGHT} isSessionOpen />,
} satisfies Readonly<Record<string, ComponentType>>;
