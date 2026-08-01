import type { OpenQuestion, PullRequestState, TurnState } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';
import type { LensKind } from '../../../../store';

type NextUpId = 'question' | 'review' | 'resume' | 'stalled' | 'close-out' | 'start' | 'follow';

export type NextUpSignal = 'question' | 'review' | 'resume' | 'stalled' | 'resolve';

export type NextUpItem = {
  readonly id: NextUpId;
  readonly title: string;
  readonly detail: string;
  readonly action: string;
  readonly tone: Tone;
  readonly lens: LensKind | null;
  readonly itemId: string | null;
  readonly signals: ReadonlyArray<NextUpSignal>;
};

export type WaitingAgent = {
  readonly lens: LensKind;
  readonly agentId: string | null;
  readonly isResolver: boolean;
};

export type StalledStep = {
  readonly runId: string;
  readonly name: string;
};

type Params = {
  readonly openQuestions: ReadonlyArray<OpenQuestion>;
  readonly questionBlocksRun: boolean;
  readonly pr: PullRequestState | null;
  readonly waiting: WaitingAgent | null;
  readonly stalledStep: StalledStep | null;
  readonly sessionStateKind: TurnState['kind'];
  readonly isFresh: boolean;
  readonly runningAgentId: string | null;
  readonly resolveCount: number;
};

const isPrLive = (pr: PullRequestState | null): pr is PullRequestState =>
  pr !== null && pr.state !== 'merged' && pr.state !== 'closed';

const isRunningState = ({ kind }: { readonly kind: TurnState['kind'] }): boolean =>
  kind === 'running' || kind === 'starting';

const firstLine = ({ text }: { readonly text: string }): string => text.trim().split('\n')[0] ?? '';

const liveSignals = ({
  openQuestions,
  pr,
  waiting,
  stalledStep,
  resolveCount,
}: Params): ReadonlyArray<NextUpSignal> => {
  const signals: NextUpSignal[] = [];
  if (openQuestions.length > 0) {
    signals.push('question');
  }
  if (isPrLive(pr) && pr.reviewDecision === 'changes_requested') {
    signals.push('review');
  }
  if (waiting !== null) {
    signals.push('resume');
  }
  if (stalledStep !== null) {
    signals.push('stalled');
  }
  if (resolveCount > 0) {
    signals.push('resolve');
  }
  return signals;
};

export const selectNextUp = (params: Params): NextUpItem | null => {
  const {
    openQuestions,
    questionBlocksRun,
    pr,
    waiting,
    stalledStep,
    sessionStateKind,
    isFresh,
    runningAgentId,
  } = params;
  const signals = liveSignals(params);
  const tail = ({ chosen }: { readonly chosen: NextUpSignal }): ReadonlyArray<NextUpSignal> =>
    signals.filter((signal) => signal !== chosen);

  const openCount = openQuestions.length;
  if (openCount > 0) {
    return {
      id: 'question',
      title: openCount === 1 ? '1 open question' : `${openCount} open questions`,
      detail: firstLine({ text: openQuestions[0]!.text }),
      action: 'Answer',
      tone: questionBlocksRun ? 'warning' : 'neutral',
      lens: 'questions',
      itemId: null,
      signals: tail({ chosen: 'question' }),
    };
  }

  if (isPrLive(pr) && pr.reviewDecision === 'changes_requested') {
    return {
      id: 'review',
      title: `Changes requested on PR #${pr.number}`,
      detail: pr.title,
      action: 'Review',
      tone: 'info',
      lens: 'pr',
      itemId: null,
      signals: tail({ chosen: 'review' }),
    };
  }

  if (waiting !== null) {
    return {
      id: 'resume',
      title: waiting.isResolver ? 'A resolver is waiting on you' : 'An agent is waiting on you',
      detail: 'It replied and nobody read it yet.',
      action: 'Resume',
      tone: 'neutral',
      lens: waiting.lens,
      itemId: waiting.agentId,
      signals: tail({ chosen: 'resume' }),
    };
  }

  if (stalledStep !== null) {
    return {
      id: 'stalled',
      title: `${stalledStep.name} stopped before finishing`,
      detail: 'The workflow cannot move on until this step runs again.',
      action: 'Restart the step',
      tone: 'warning',
      lens: 'workflows',
      itemId: stalledStep.runId,
      signals: tail({ chosen: 'stalled' }),
    };
  }

  if (isPrLive(pr) && !pr.isDraft && !isRunningState({ kind: sessionStateKind })) {
    return {
      id: 'close-out',
      title: `PR #${pr.number} is done but not merged`,
      detail: pr.title,
      action: 'Close it out',
      tone: 'success',
      lens: 'pr',
      itemId: null,
      signals,
    };
  }

  if (isFresh) {
    return {
      id: 'start',
      title: 'Nothing has started yet',
      detail: 'A workflow runs scout, plan, implement, test and review end to end.',
      action: 'Start a workflow',
      tone: 'neutral',
      lens: null,
      itemId: null,
      signals,
    };
  }

  if (isRunningState({ kind: sessionStateKind }) || runningAgentId !== null) {
    return {
      id: 'follow',
      title: 'Work is running',
      detail: 'Nothing needs you while it does.',
      action: 'Follow the run',
      tone: 'info',
      lens: 'agents',
      itemId: runningAgentId,
      signals,
    };
  }

  return null;
};
