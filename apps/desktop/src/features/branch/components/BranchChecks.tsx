import { useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { REVIEW_SOURCE_CAPABILITIES, REVIEW_SOURCE_LABEL } from '@goodboy/core';
import { Button, EmptyState, PageColumn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { ExternalLink } from 'lucide-react';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../shared/components/conceptIcons';
import { openUrl } from '../../../shared/lib/editor';
import { useAppStore } from '../../../store';
import { selectedReviewEntryOf } from '../../../store/slices/review-source/activeReviewSource';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import { useSessionRepo } from '../../../store/slices/worktrees/useSessionRepo';
import { useActionControls } from '../../actions/useActionControls';
import { useGithubConnection } from '../../integrations/github/useGithubConnection';
import { openToolSettings } from '../../integrations/openToolSettings';
import { ChecksMode } from '../../review/components/ReviewPane/modes/ChecksMode';
import { checksViewOf, type ChecksHost, type ChecksHostKind } from '../checksViewOf';
import { usePullRequestView } from '../hooks/usePullRequestView';
import { repoNameOf } from '../repoNameOf';
import { ChecksDeniedNotice } from './ChecksDeniedNotice';
import { ChecksFailedNotice } from './ChecksFailedNotice';

type Props = {
  readonly sessionId: SessionId;
};

const HOST_NOUN: Readonly<Record<ChecksHost, string>> = {
  gitlab: 'pipelines',
  bitbucket: 'checks',
};

const CREATE_ACTION_ID = 'pullRequest.create';

export const BranchChecks = ({ sessionId }: Props) => {
  const github = useAppStore((s) => s.sessionGithub[sessionId] ?? null);
  const workspaceId = useAppStore((s) => sessionById(s.sessions, sessionId)?.workspaceId ?? null);
  const refreshSessionPrDetail = useAppStore((s) => s.refreshSessionPrDetail);
  const repo = useSessionRepo({ sessionId });
  const projectId = repo?.projectId ?? null;
  const hasBinding = useAppStore((s) =>
    workspaceId === null
      ? false
      : (s.workspaceIntegrations[workspaceId] ?? []).some(
          (binding) =>
            binding.provider === 'github' &&
            (binding.projectId === null || binding.projectId === projectId),
        ),
  );
  const connection = useGithubConnection({ workspaceId });
  const host = useAppStore(
    useShallow((s) => {
      const entry = selectedReviewEntryOf({ state: s, sessionId });
      const kind: ChecksHostKind = entry?.kind ?? 'local';
      return { kind, url: entry?.url ?? null, number: entry?.number ?? null };
    }),
  );
  const canReadChecks = REVIEW_SOURCE_CAPABILITIES[host.kind].canReadChecks;
  const isPortHost = host.kind === 'gitlab' || host.kind === 'bitbucket';
  const portView = usePullRequestView({
    sessionId,
    isEnabled: isPortHost && canReadChecks,
    fallbackNumber: host.number,
  });
  const create = useActionControls({
    target: { kind: 'pullRequest', sessionId, prNumber: null },
  });

  const pr = github?.pr ?? null;
  const detail = github?.detail ?? null;
  const isChecking = isPortHost ? portView.isLoading : github?.detailLoading === true;
  const prNumber = pr?.number ?? null;
  const hasDetail = detail !== null && detail.prNumber === prNumber;

  useEffect(() => {
    if (prNumber === null || hasDetail) {
      return;
    }
    void refreshSessionPrDetail(sessionId);
  }, [hasDetail, prNumber, refreshSessionPrDetail, sessionId]);

  const reloadPortView = portView.reload;
  const checkAgain = useCallback(() => {
    if (isPortHost) {
      reloadPortView();
      return;
    }
    void refreshSessionPrDetail(sessionId, { force: true });
  }, [isPortHost, refreshSessionPrDetail, reloadPortView, sessionId]);

  const view = checksViewOf({
    hostKind: host.kind,
    hostUrl: host.url,
    pr,
    detail,
    isDetailLoading: isChecking,
    detailError: github?.detailError ?? null,
    hasFetchedDetail: (github?.detailFetchedAt ?? null) !== null,
    canReadChecks,
    portChecks: portView.view?.checks ?? null,
  });

  const createAction = create.actions.find((action) => action.id === CREATE_ACTION_ID);

  const stateNotice = () => {
    if (view.kind === 'host') {
      const label = REVIEW_SOURCE_LABEL[view.host];
      const url = view.url;
      return (
        <EmptyState
          bordered
          icon={CONCEPT_ICONS.checks}
          tone={CONCEPT_TONE.checks}
          title={`Goodboy doesn't show ${label} ${HOST_NOUN[view.host]} yet`}
          action={
            url === null ? undefined : (
              <Button variant="ghost" size="sm" onClick={() => void openUrl(url)}>
                View on {label}
                <ExternalLink size={ICON_SIZE.row} aria-hidden />
              </Button>
            )
          }
        />
      );
    }
    if (view.kind === 'no-pr' || (pr === null && !isPortHost)) {
      return (
        <EmptyState
          bordered
          icon={CONCEPT_ICONS.checks}
          tone={CONCEPT_TONE.checks}
          title="Checks run once the pull request exists"
          action={
            <Button
              variant="secondary"
              size="sm"
              disabled={createAction === undefined || createAction.blockedReason !== null}
              onClick={() => create.trigger({ actionId: CREATE_ACTION_ID })}
            >
              Create pull request
            </Button>
          }
        />
      );
    }
    if (view.kind === 'denied') {
      return (
        <ChecksDeniedNotice
          host={host.kind === 'gitlab' ? 'gitlab' : 'github'}
          repoName={repoNameOf({ url: pr?.url ?? host.url ?? '' })}
          isTokenBound={connection.mode === 'pat' || hasBinding}
          isChecking={isChecking}
          error={view.error}
          onOpenSettings={() =>
            openToolSettings({ tool: host.kind === 'gitlab' ? 'gitlab' : 'github' })
          }
          onCheckAgain={checkAgain}
        />
      );
    }
    if (view.kind === 'failed') {
      return <ChecksFailedNotice isChecking={isChecking} error={view.error} onRetry={checkAgain} />;
    }
    return null;
  };

  const notice = stateNotice();

  return (
    <PageColumn width="column">
      {notice === null ? (
        <ChecksMode
          checks={view.kind === 'ready' ? view.checks : []}
          fallbackUrl={pr?.url ?? host.url ?? ''}
          hostLabel={REVIEW_SOURCE_LABEL[isPortHost ? host.kind : 'github']}
          isLoading={view.kind === 'loading'}
          pr={pr ?? undefined}
          detail={detail}
          onOpenUrl={(url) => void openUrl(url)}
        />
      ) : (
        <section aria-label="Checks" className="flex flex-col gap-3">
          {notice}
        </section>
      )}
    </PageColumn>
  );
};
