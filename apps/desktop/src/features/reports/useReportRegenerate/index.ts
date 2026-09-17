import { useEffect, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { SessionArtifact, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { asReportType } from '../reportTypes';

export const REGENERATE_READY_HINT = 'Run the report again on the same evidence pack';

export const REGENERATE_BLOCKED_HINT =
  'the evidence pack this report was built from is no longer in memory, so regenerating would build a different report';

export type ReportRegenerateHandle = Readonly<{
  isSupported: boolean;
  canRegenerate: boolean;
  isRegenerating: boolean;
  hint: string;
  error: string | null;
  regenerate: () => void;
}>;

type Params = Readonly<{
  sessionId: SessionId;
  artifact: SessionArtifact;
}>;

export const useReportRegenerate = ({ sessionId, artifact }: Params): ReportRegenerateHandle => {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const spawnReportAgent = useAppStore((state) => state.spawnReportAgent);
  const kickoff = useAppStore((state) => {
    const events = state.transcripts?.[artifact.agentId] ?? [];
    const first = events.find((event) => event.kind === 'user_text');
    return first?.kind === 'user_text' ? first.text : null;
  });
  const isSupported = artifact.kind === 'report';
  const canRegenerate = isSupported && kickoff !== null && kickoff.trim().length > 0;

  useEffect(() => {
    setError(null);
    setIsRegenerating(false);
  }, [artifact.id]);

  const regenerate = () => {
    if (isRegenerating || !canRegenerate || artifact.kind !== 'report' || kickoff === null) {
      return;
    }
    setIsRegenerating(true);
    setError(null);
    spawnReportAgent({
      sessionId,
      reportType: asReportType({ value: artifact.metadata.reportType }) ?? 'session-summary',
      workflowRunId: artifact.workflowRunId,
      attachments: [],
      evidence: kickoff,
    })
      .then(() => {
        window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
      })
      .catch((cause: unknown) => {
        setError(formatError(cause));
      })
      .finally(() => {
        setIsRegenerating(false);
      });
  };

  return {
    isSupported,
    canRegenerate,
    isRegenerating,
    hint: canRegenerate ? REGENERATE_READY_HINT : REGENERATE_BLOCKED_HINT,
    error,
    regenerate,
  };
};
