import { useState } from 'react';
import type {
  IsoDateTime,
  SessionExternalTaskProvider,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { formatError } from '../../../../../../shared/lib/errors';
import { IssuePicker } from '../../../../../integrations/components/IssuePicker';
import { useIssueCandidates } from '../../../../../integrations/hooks/useIssueCandidates';
import type { IssueCandidate } from '../../../../../integrations/fetchIssueCandidates';
import { resolvePastedIssueCandidate } from './resolvePastedIssueCandidate';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly provider: SessionExternalTaskProvider;
  readonly providerLabel: string;
  readonly onLinked?: () => void;
};

export const LinkIssueForm = ({
  sessionId,
  workspaceId,
  provider,
  providerLabel,
  onLinked,
}: Props) => {
  const [error, setError] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const linkSessionExternalTask = useAppStore((state) => state.linkSessionExternalTask);
  const candidates = useIssueCandidates({ workspaceId, provider });

  const handlePick = async (candidate: IssueCandidate) => {
    setError(null);
    setIsLinking(true);
    try {
      await linkSessionExternalTask(sessionId, {
        provider,
        externalId: candidate.externalId,
        identifier: candidate.identifier,
        title: candidate.title,
        url: candidate.url,
        createdAt: new Date().toISOString() as IsoDateTime,
      });
      if (onLinked != null) {
        onLinked();
      }
    } catch (linkError) {
      setError(formatError(linkError));
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`${provider}-issue-picker`} className="text-xs font-medium text-foreground">
        Link an issue
      </label>
      <IssuePicker
        inputId={`${provider}-issue-picker`}
        rows={candidates.rows}
        isLoading={candidates.isLoading}
        isLoaded={candidates.isLoaded}
        error={candidates.error}
        value={null}
        placeholder={`Search ${providerLabel} issues or paste a URL…`}
        disabled={isLinking}
        resolvePaste={(rawValue) => resolvePastedIssueCandidate({ provider, rawValue })}
        onOpen={candidates.load}
        onPick={(candidate) => void handlePick(candidate)}
        onClear={() => undefined}
      />
      {error != null ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
};
