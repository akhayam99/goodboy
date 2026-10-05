import { useCallback, useMemo } from 'react';
import type { AgentId, PullRequestState, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../store';
import { useTranscript } from '../../../store/slices/transcripts/selectors';
import type { ScribeWork } from '../../../store/slices/scribe/types';
import { reduceTranscript } from '../../../features/chat/utils/transcript-items';
import { scribeMountOf } from '../../utils/scribeMountOf';
import { scribeProposalOf, type ScribeProposal } from '../../utils/scribeProposal';

export type ScribeProposalState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'creating' }
  | { readonly kind: 'created'; readonly number: number; readonly url: string | null }
  | { readonly kind: 'failed'; readonly reason: string };

export type ScribeProposalSnapshot = {
  readonly proposal: ScribeProposal;
  readonly state: ScribeProposalState;
  readonly isWriting: boolean;
  readonly canRetry: boolean;
  readonly retry: () => void;
};

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

const stateOf = ({
  work,
  pr,
}: {
  readonly work: ScribeWork | null;
  readonly pr: PullRequestState | null;
}): ScribeProposalState => {
  if (work?.status === 'creating' || work?.status === 'ready') {
    return { kind: 'creating' };
  }
  if (work?.status === 'created' && work.pullRequest !== null) {
    return { kind: 'created', number: work.pullRequest.number, url: work.pullRequest.url };
  }
  if (work?.status === 'failed' && work.error !== null) {
    return { kind: 'failed', reason: work.error };
  }
  if (pr !== null && pr.state !== 'closed') {
    return { kind: 'created', number: pr.number, url: pr.url };
  }
  return { kind: 'idle' };
};

export const useScribeProposal = ({
  sessionId,
  agentId,
}: Params): ScribeProposalSnapshot | null => {
  const transcript = useTranscript(agentId);
  const proposal = useMemo(
    () => scribeProposalOf({ items: reduceTranscript(transcript) }),
    [transcript],
  );
  const work = useAppStore((state) => {
    const key = state.scribeAgents[agentId];
    return key === undefined ? null : (state.scribeWork[key] ?? null);
  });
  const mounts = useAppStore((state) => state.sessionProjectMounts[sessionId] ?? EMPTY_ARRAY);
  const mountId = useMemo(
    () => work?.mountId ?? scribeMountOf({ mounts, kickoff: proposal?.kickoff ?? null }),
    [mounts, proposal?.kickoff, work?.mountId],
  );
  const pr = useAppStore((state) =>
    mountId === null ? null : (state.mountGithub[mountId]?.pr ?? null),
  );
  const resume = useAppStore((state) => state.resumeScribePullRequest);
  const state = useMemo(() => stateOf({ work, pr }), [pr, work]);
  const isWriting = work?.status === 'writing';
  const hasText = proposal !== null && (proposal.title !== null || proposal.body !== null);
  const canRetry =
    hasText && mountId !== null && (state.kind === 'idle' || state.kind === 'failed') && !isWriting;
  const retry = useCallback(() => {
    if (!canRetry || proposal === null || mountId === null) {
      return;
    }
    void resume({
      sessionId,
      mountId,
      agentId,
      output: {
        prTitle: proposal.title,
        prBody: proposal.body,
        commitMessages: [],
        changelogEntry: proposal.changelogEntry,
      },
    });
  }, [agentId, canRetry, mountId, proposal, resume, sessionId]);
  return useMemo(
    () => (proposal === null ? null : { proposal, state, isWriting, canRetry, retry }),
    [canRetry, isWriting, proposal, retry, state],
  );
};
