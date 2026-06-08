import { useEffect, useState } from 'react';
import { Divider } from '@goodboy/ui';
import { GitPullRequest } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { InboxList } from './InboxList';
import { PrDetailPanel } from './PrDetailPanel';
import { useGithubInbox } from './useGithubInbox';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { ScrollFade } from '../../../../shared/components/ScrollFade';

interface Props {
  readonly workspaceName: string;
  readonly initialSessionId: SessionId | null;
  readonly initialPrNumber?: number | null;
  readonly initialThreadId?: string | null;
  readonly onClose: () => void;
}

export function GitHubStudio({
  workspaceName,
  initialSessionId,
  initialPrNumber = null,
  initialThreadId = null,
  onClose,
}: Props) {
  const groups = useGithubInbox();
  const [focused, setFocused] = useState<SessionId | null>(initialSessionId);

  useEffect(() => {
    if (focused !== null) return;
    const first = groups[0]?.rows[0]?.session.id ?? null;
    if (first) setFocused(first);
  }, [focused, groups]);

  const onInitialSession = focused === initialSessionId;

  return (
    <StudioShell
      icon={GitPullRequest}
      title="GitHub"
      workspaceName={workspaceName}
      closeLabel="close github studio"
      onClose={onClose}
    >
      {(requestClose) => (
        <>
          <ScrollFade className="w-72 shrink-0">
            <InboxList groups={groups} focusedSessionId={focused} onSelect={setFocused} />
          </ScrollFade>
          <Divider orientation="vertical" />
          <div className="min-h-0 flex-1">
            <PrDetailPanel
              sessionId={focused}
              initialPrNumber={onInitialSession ? initialPrNumber : null}
              initialThreadId={onInitialSession ? initialThreadId : null}
              onClose={requestClose}
            />
          </div>
        </>
      )}
    </StudioShell>
  );
}
