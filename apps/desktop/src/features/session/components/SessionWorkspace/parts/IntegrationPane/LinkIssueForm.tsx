import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Divider } from '@goodboy/ui';
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
import { slackGetThread, slackListChannels } from '../../../../../integrations/slack/client';
import { hydrateSlackThreadTask } from '../../../../../integrations/slack/hydrateSlackThreadTask';
import { parseSlackThreadExternalId } from '../../../../../integrations/slack/threadFormulas';
import { resolvePastedIssueCandidate } from './resolvePastedIssueCandidate';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly provider: SessionExternalTaskProvider;
  readonly providerLabel: string;
  readonly nounPhrase: string;
  readonly nounPlural: string;
  readonly onLinked?: () => void;
};

type HydrateParams = {
  readonly workspaceId: WorkspaceId;
  readonly candidate: IssueCandidate;
};

type Hydrated = {
  readonly identifier: string;
  readonly title: string;
};

const hydrateSlackCandidate = async ({
  workspaceId,
  candidate,
}: HydrateParams): Promise<Hydrated> => {
  const parsed = parseSlackThreadExternalId({ externalId: candidate.externalId });
  if (parsed == null) {
    return { identifier: candidate.identifier, title: candidate.title };
  }
  const [channels, messages] = await Promise.all([
    slackListChannels({ workspaceId }),
    slackGetThread({ workspaceId, channelId: parsed.channelId, threadTs: parsed.threadTs }),
  ]);
  return hydrateSlackThreadTask({
    channelId: parsed.channelId,
    threadTs: parsed.threadTs,
    channels,
    messages,
  });
};

export const LinkIssueForm = ({
  sessionId,
  workspaceId,
  provider,
  providerLabel,
  nounPhrase,
  nounPlural,
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
      const hydrated =
        provider === 'slack'
          ? await hydrateSlackCandidate({ workspaceId, candidate })
          : { identifier: candidate.identifier, title: candidate.title };
      await linkSessionExternalTask(sessionId, {
        provider,
        externalId: candidate.externalId,
        identifier: hydrated.identifier,
        title: hydrated.title,
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
        {`Link ${nounPhrase}`}
      </label>
      <IssuePicker
        inputId={`${provider}-issue-picker`}
        rows={candidates.rows}
        isLoading={candidates.isLoading}
        isLoaded={candidates.isLoaded}
        error={candidates.error}
        value={null}
        placeholder={`Search ${providerLabel} ${nounPlural} or paste a URL…`}
        disabled={isLinking}
        resolvePaste={(rawValue) => resolvePastedIssueCandidate({ provider, rawValue })}
        onOpen={candidates.load}
        onPick={(candidate) => void handlePick(candidate)}
        onClear={() => undefined}
      />
      {error != null ? (
        <>
          <Divider />
          <footer role="alert" className="flex items-center gap-1 text-xs text-danger">
            <AlertTriangle size={12} aria-hidden className="shrink-0" />
            {error}
          </footer>
        </>
      ) : null}
    </div>
  );
};
