import { classifyWorkflowChain } from '@goodboy/core';
import type { Agent, Step, Workflow } from '@goodboy/types';

export type WorkflowBlockReason = 'questions' | 'summarizer' | 'failed-step' | 'turn-running';

export type WorkflowAdvanceState =
  | { readonly kind: 'complete' }
  | { readonly kind: 'automatic'; readonly step: Step }
  | { readonly kind: 'ready'; readonly step: Step }
  | {
      readonly kind: 'blocked';
      readonly reason: WorkflowBlockReason;
      readonly step: Step;
      readonly failedStep: Step | null;
    };

type Params = {
  readonly workflow: Workflow;
  readonly agents: ReadonlyArray<Agent>;
  readonly hasOpenQuestions: boolean;
  readonly isSummarizerRunning: boolean;
  readonly isTurnRunning: boolean;
  readonly isAutoRun?: boolean;
};

export const resolveWorkflowAdvance = ({
  workflow,
  agents,
  hasOpenQuestions,
  isSummarizerRunning,
  isTurnRunning,
  isAutoRun = false,
}: Params): WorkflowAdvanceState => {
  const chain = classifyWorkflowChain(workflow, agents);
  if (chain.kind === 'complete') {
    return { kind: 'complete' };
  }
  const step = chain.kind === 'blocked' ? chain.failedStep : chain.step;
  const failedStep = chain.kind === 'blocked' ? chain.failedStep : null;
  if (hasOpenQuestions) {
    return { kind: 'blocked', reason: 'questions', step, failedStep };
  }
  if (isSummarizerRunning && !isAutoRun) {
    return { kind: 'blocked', reason: 'summarizer', step, failedStep };
  }
  if (chain.kind === 'blocked') {
    return { kind: 'blocked', reason: 'failed-step', step, failedStep };
  }
  if (isAutoRun) {
    return { kind: 'automatic', step };
  }
  if (isTurnRunning || agents.some((agent) => agent.status === 'running')) {
    return { kind: 'blocked', reason: 'turn-running', step, failedStep };
  }
  return { kind: 'ready', step };
};
