import { useMemo } from 'react';
import { extractScribeText } from '@goodboy/core';
import type { AgentId, SessionId } from '@goodboy/types';
import { CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import { classifyAgent } from '../../../session/agent-kind';
import { useScribeProposal } from '../../../../shared/hooks/useScribeProposal';
import { ScribeProposalView } from '../../../../shared/components/ScribeProposalView';
import { TranscriptShell } from '../TranscriptShell';

type Props = {
  readonly assistantText: string;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export const ScribeTextCard = ({ assistantText, sessionId, agentId }: Props) => {
  const own = useMemo(() => extractScribeText(assistantText), [assistantText]);
  const isScribe = useAppStore((state) => {
    const agent = (state.sessionPhaseRuns[sessionId] ?? []).find((run) => run.id === agentId);
    return (
      agent !== undefined &&
      classifyAgent({ agent, override: state.agentKindOverride[agentId] ?? null }) === 'scribe'
    );
  });
  const snapshot = useScribeProposal({ sessionId, agentId });
  if (!isScribe) {
    return null;
  }
  const isLatest = snapshot !== null && snapshot.proposal.latestText === assistantText;
  const proposal =
    isLatest && snapshot !== null
      ? snapshot.proposal
      : { title: own.prTitle, body: own.prBody, changelogEntry: own.changelogEntry };
  return (
    <TranscriptShell tone={CONCEPT_TONE.pr} variant="boxed" className="w-full">
      <ScribeProposalView
        proposal={proposal}
        state={isLatest && snapshot !== null ? snapshot.state : null}
        canRetry={isLatest && snapshot !== null && snapshot.canRetry}
        isCompact
        hasHeader
        onRetry={() => snapshot?.retry()}
      />
    </TranscriptShell>
  );
};
