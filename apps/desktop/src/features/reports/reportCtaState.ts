import type { Agent } from '@goodboy/types';

export type ReportCtaBlockReason = 'no-evidence' | 'run-active' | 'session-busy';

export type ReportCtaState =
  Readonly<{ kind: 'ready' }> | Readonly<{ kind: 'blocked'; reason: ReportCtaBlockReason }>;

export type ReportCtaParams = Readonly<{
  agents: ReadonlyArray<Agent>;
  runAgents: ReadonlyArray<Agent> | null;
  isTurnRunning: boolean;
  isSummarizerRunning: boolean;
}>;

export const REPORT_CTA_BLOCK_COPY: Record<ReportCtaBlockReason, string> = {
  'no-evidence': 'nothing has run yet, so there is nothing to report on',
  'run-active': 'the run is still going, finish it first',
  'session-busy': 'the session is busy, wait for it to settle',
};

const isLive = (agent: Agent): boolean => agent.status === 'pending' || agent.status === 'running';

export const resolveReportCtaState = ({
  agents,
  runAgents,
  isTurnRunning,
  isSummarizerRunning,
}: ReportCtaParams): ReportCtaState => {
  const source = runAgents ?? agents;
  if (source.length === 0) {
    return { kind: 'blocked', reason: 'no-evidence' };
  }
  if (source.some(isLive)) {
    return { kind: 'blocked', reason: 'run-active' };
  }
  if (agents.some(isLive) || isTurnRunning || isSummarizerRunning) {
    return { kind: 'blocked', reason: 'session-busy' };
  }
  return { kind: 'ready' };
};
