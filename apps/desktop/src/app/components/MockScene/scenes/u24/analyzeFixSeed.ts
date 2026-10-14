import type { Agent, AgentId, BranchCommit, WorktreeStatus } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { mockSceneIpc } from '../mockSceneIpc';
import { checksAnalyzeSeed } from './checksAnalyzeSeed';

const FIX_ID: AgentId = JSON.parse(JSON.stringify('mock-u24-analyze-fix-implementer'));
const FIX_COMMIT_SHA = '9e4c1a7d3b5f60718293a4b5c6d7e8f901234567';
const ANCHOR = '2026-10-10T09:40:00.000Z';
const MS_PER_SECOND = 1_000;
const COMMIT_AFTER_START_SECONDS = 60;
const clock = sceneClock({ anchor: ANCHOR });

export type AnalyzeFixPhase = 'proposal' | 'fixing' | 'fixed-local' | 'fixed-pushed';

type Params = {
  readonly phase: AnalyzeFixPhase;
  readonly shouldOpenDrawer?: boolean;
};

export const analyzeFixSeed = ({ phase, shouldOpenDrawer = false }: Params) => {
  const seed = checksAnalyzeSeed({ phase: 'proposal', shouldOpenDrawer });
  if (phase === 'proposal') {
    return seed;
  }
  const isFinished = phase === 'fixed-local' || phase === 'fixed-pushed';
  const fix: Agent = {
    ...seed.agent,
    id: FIX_ID,
    name: 'Implementer',
    kind: 'implementer',
    status: isFinished ? 'completed' : 'running',
    ordinal: 2,
    parentAgentId: seed.agent.id,
    sourceKind: 'failed_check',
    sourceCommentUrl: seed.check.detailsUrl ?? seed.pullRequest.url,
    modelOverride: 'claude-sonnet-5-5',
    providerOverride: 'anthropic',
    effort: 'high',
  };
  if (isFinished) {
    const isPushed = phase === 'fixed-pushed';
    const commit: BranchCommit = {
      sha: FIX_COMMIT_SHA,
      shortSha: FIX_COMMIT_SHA.slice(0, 7),
      subject: 'Guard the retry against double credits',
      author: 'Acme Dev',
      timestamp: Math.floor(clock.ms({ at: ANCHOR }) / MS_PER_SECOND) + COMMIT_AFTER_START_SECONDS,
      pushed: isPushed,
      parentSha: null,
    };
    const status: WorktreeStatus = {
      branch: seed.repo.branch,
      head: commit.sha,
      headSubject: commit.subject,
      upstream: `origin/${seed.repo.branch}`,
      upstreamDistance: { kind: 'known', ahead: isPushed ? 0 : 1, behind: 0 },
      mainDistance: { kind: 'known', ahead: 1, behind: 0 },
      workingTree: {
        kind: 'known',
        staged: 0,
        unstaged: 0,
        untracked: 0,
        unmerged: 0,
        changed: 0,
      },
      inProgress: null,
    };
    mockSceneIpc((command) => {
      if (command === 'worktree_commits') {
        return [commit];
      }
      if (command === 'worktree_status') {
        return status;
      }
      return null;
    });
    useAppStore.setState((state) => ({
      sessionPhaseRuns: { [seed.sessionId]: [seed.agent, fix] },
      agentTurnState: {
        ...state.agentTurnState,
        [fix.id]: { kind: 'ended', endedAt: seed.events[0]!.at },
      },
      transcripts: { ...state.transcripts, [fix.id]: [] },
      checkFixCommits: {
        [fix.id]: {
          kind: 'found',
          sha: commit.shortSha,
          subject: commit.subject,
          count: 1,
          unpushed: isPushed ? 0 : 1,
        },
      },
      sessionOpenQuestions: { [seed.sessionId]: [] },
      sessionAnsweredQuestions: { [seed.sessionId]: [] },
      sessionArtifacts: { [seed.sessionId]: [] },
      sessionPlans: { [seed.sessionId]: [] },
    }));
    return { ...seed, fix };
  }
  const running = Object.values(useAppStore.getState().agentTurnState).find(
    (turn) => turn.kind === 'running',
  );
  useAppStore.setState((state) => ({
    sessionPhaseRuns: { [seed.sessionId]: [seed.agent, fix] },
    agentTurnState: {
      ...state.agentTurnState,
      [fix.id]:
        running === undefined || running.kind !== 'running'
          ? { kind: 'idle', lastActivityAt: seed.agent.startedAt ?? seed.events[0]!.at }
          : { kind: 'running', runId: running.runId, startedAt: running.startedAt },
    },
    transcripts: { ...state.transcripts, [fix.id]: [] },
    sessionOpenQuestions: { [seed.sessionId]: [] },
    sessionAnsweredQuestions: { [seed.sessionId]: [] },
    sessionArtifacts: { [seed.sessionId]: [] },
    sessionPlans: { [seed.sessionId]: [] },
  }));
  return { ...seed, fix };
};
