import { useState, type FormEvent } from 'react';
import { Link2 } from 'lucide-react';
import type {
  IsoDateTime,
  SessionExternalTaskProvider,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { Button, Input } from '@goodboy/ui';
import { useAppStore } from '../../../../../../store';
import { formatError } from '../../../../../../shared/lib/errors';
import { IssuePicker } from '../../../../../integrations/components/IssuePicker';
import { useIssueCandidates } from '../../../../../integrations/hooks/useIssueCandidates';
import type { IssueCandidate } from '../../../../../integrations/fetchIssueCandidates';
import { parseIntegrationTaskUrl } from './parseIntegrationTaskUrl';

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
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const linkSessionExternalTask = useAppStore((state) => state.linkSessionExternalTask);
  const candidates = useIssueCandidates({ workspaceId, provider });

  const finishLink = () => {
    if (onLinked != null) {
      onLinked();
    }
  };

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
      finishLink();
    } catch (linkError) {
      setError(formatError(linkError));
    } finally {
      setIsLinking(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedTask = parseIntegrationTaskUrl({ provider, rawUrl: url });
    if (parsedTask == null) {
      setError('Paste an issue URL to link it.');
      return;
    }
    setError(null);
    setIsLinking(true);
    try {
      await linkSessionExternalTask(sessionId, {
        ...parsedTask,
        provider,
        createdAt: new Date().toISOString() as IsoDateTime,
      });
      setUrl('');
      finishLink();
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
        placeholder={`Search ${providerLabel} issues assigned to you…`}
        disabled={isLinking}
        onOpen={candidates.load}
        onPick={(candidate) => void handlePick(candidate)}
        onClear={() => undefined}
      />
      <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
        <label
          htmlFor={`${provider}-issue-url`}
          className="text-xs font-medium text-muted-foreground"
        >
          Or paste a {providerLabel} issue URL
        </label>
        <div className="flex items-center gap-2">
          <Input
            id={`${provider}-issue-url`}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder={`Or paste a ${providerLabel} issue URL`}
          />
          <Button type="submit" size="sm" disabled={isLinking}>
            <Link2 size={13} aria-hidden />
            Link
          </Button>
        </div>
        {error != null ? <p className="text-xs text-danger">{error}</p> : null}
      </form>
    </div>
  );
};
