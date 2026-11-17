import type { WorkNodeState } from '@goodboy/ui';
import { NAMES } from '../../../shared/utils/names';

type ItemWorkWord = Readonly<{
  word: string;
  node: WorkNodeState;
  hasClock: boolean;
}>;

export const ITEM_WORK_WORDS = {
  state: {
    starting: { word: 'Starting', node: 'queued', hasClock: false },
    queued: { word: NAMES.queued, node: 'queued', hasClock: false },
    analyzing: { word: 'Analyzing', node: 'running', hasClock: true },
    fixing: { word: 'Fixing', node: 'running', hasClock: true },
    resolving: { word: 'Resolving', node: 'running', hasClock: true },
    inRun: { word: 'In a run', node: 'running', hasClock: false },
    causeFound: { word: 'Cause found', node: 'ready', hasClock: false },
    fixReady: { word: NAMES.fixReady, node: 'ready', hasClock: false },
    question: { word: 'Question', node: 'question', hasClock: false },
    fixedNotPushed: { word: 'Fixed, not pushed', node: 'ready', hasClock: false },
    appliedNotPushed: { word: 'Applied, not pushed', node: 'ready', hasClock: false },
    pushedChecking: { word: 'Pushed', node: 'running', hasClock: true },
    pushed: { word: 'Pushed', node: 'done', hasClock: false },
    fixed: { word: 'Fixed', node: 'done', hasClock: false },
    noFixFound: { word: 'No fix found', node: 'skipped', hasClock: false },
    stopped: { word: NAMES.stopped, node: 'stopped', hasClock: false },
    failed: { word: NAMES.failed, node: 'failed', hasClock: false },
  },
  verb: {
    stop: NAMES.stop,
    stopAll: NAMES.stopAll,
    openTranscript: NAMES.openTranscript,
    openRun: 'Open run',
    reviewFix: 'Review fix',
    review: 'Review',
    applyFix: NAMES.applyFix,
    apply: 'Apply',
    push: NAMES.push,
    retry: NAMES.retry,
    startOver: 'Start over',
    analyzeAgain: 'Analyze again',
    answer: 'Answer',
    openChanges: 'Open changes',
  },
} as const satisfies Readonly<{
  state: Readonly<Record<string, ItemWorkWord>>;
  verb: Readonly<Record<string, string>>;
}>;

export type ItemWorkState = keyof typeof ITEM_WORK_WORDS.state;
