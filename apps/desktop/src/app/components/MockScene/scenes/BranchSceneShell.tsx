import { useEffect, useState } from 'react';
import type { ResolvePublicationPreview } from '@goodboy/types';
import { BranchPage } from '../../../../features/branch/components/BranchPage';
import { useAppStore } from '../../../../store';
import {
  EXPANDED_THREAD_ID,
  SESSION,
  THREAD_IDS,
  seedResolveScene,
  type ReplyOnlyVariant,
} from './resolveSeed';
import { applyResolveLaneSeed, type ResolveLaneVariant } from './resolveLaneSeed';

const PUSH_PREVIEW: ResolvePublicationPreview = {
  publicationId: 'mock-branch-publication',
  repo: 'harborline/payments-api',
  prNumber: 318,
  branch: 'hl/fix-duplicate-credit',
  localHead: 'a41c9e2aaaa',
  remoteHead: '7d02b11bbbb',
  requiresPush: true,
  frozenAt: 1,
  commits: [
    {
      sha: 'a41c9e2aaaa',
      shortSha: 'a41c9e2',
      subject: 'Redact the webhook payload',
      author: 'resolver',
      timestamp: 1,
      pushed: false,
      parentSha: null,
      threadIds: [THREAD_IDS.logRedact],
    },
  ],
  unapproved: [],
  earlierCommits: [
    {
      sha: '9e4f1c2bbbb',
      shortSha: '9e4f1c2',
      subject: 'Batch the ledger lookups',
      author: 'resolver',
      timestamp: 0,
      pushed: false,
      parentSha: null,
    },
  ],
  replies: [{ threadId: THREAD_IDS.logRedact, body: 'Redacted.', revision: 1, closes: true }],
  notes: [],
  excluded: [{ threadId: EXPANDED_THREAD_ID, reason: 'needs_you' }],
  drift: [],
  blocker: null,
};

type Props = {
  readonly width: string | null;
  readonly openPush: boolean;
  readonly threadId?: string;
  readonly replyOnly?: ReplyOnlyVariant;
  readonly lane?: ResolveLaneVariant;
};

export const BranchSceneShell = ({
  width,
  openPush,
  threadId = EXPANDED_THREAD_ID,
  replyOnly,
  lane,
}: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedResolveScene({
      expandedThreadId: threadId,
      ...(replyOnly !== undefined && { replyOnly }),
    });
    if (lane !== undefined) {
      applyResolveLaneSeed({ variant: lane });
    }
    useAppStore.setState({
      preparePublication: async () => PUSH_PREVIEW,
    });
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady || !openPush) {
      return;
    }
    const timer = window.setTimeout(
      () => document.querySelector<HTMLElement>('[data-branch-primary]')?.click(),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [isReady, openPush]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <div className="mx-auto h-full" style={width === null ? undefined : { width }}>
        <BranchPage session={SESSION} workingDir={null} />
      </div>
    </main>
  );
};
