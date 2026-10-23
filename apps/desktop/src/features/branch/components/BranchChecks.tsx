import { useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { REVIEW_SOURCE_CAPABILITIES, REVIEW_SOURCE_LABEL } from '@goodboy/core';
import { Button, EmptyState, PageColumn } from '@goodboy/ui';
import type { MountId, PrCheckRun, SessionId } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../shared/components/conceptIcons';
import { hostIconOf } from '../../../shared/hostIconOf';
import { openUrl } from '../../../shared/lib/editor';
import { useAppStore } from '../../../store';
import { branchGithubOf } from '../../../store/slices/github/branchGithubOf';
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
import { AnalyzedCheckRow } from './AnalyzedCheckRow';
import { ChecksDeniedNotice } from './ChecksDeniedNotice';
import { ChecksFailedNotice } from './ChecksFailedNotice';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId?: MountId | null;
};

const HOST_NOUN: Readonly<Record<ChecksHost, string>> = {
  gitlab: 'pipelines',
  bitbucket: 'checks',
};

const CREATE_ACTION_ID = 'pullRequest.create';

const FAILED_CONCLUSIONS: ReadonlySet<PrCheckRun['conclusion']> = new Set<PrCheckRun['conclusion']>(
  ['failure', 'timed_out', 'cancelled'],
);

export const BranchChecks = ({ sessionId, mountId = null }: Props) => {
  const github = useAppStore((s) => branchGithubOf({ state: s, sessionId, mountId }));
  const workspaceId = useAppStore((s) => sessionById(s.sessions, sessionId)?.workspaceId ?? null);
  const refreshSessionPrDetail = useAppStore((s) => s.refreshSessionPrDetail);
  const repo = useSessionRepo({ sessionId, mountId });
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
      const entry = selectedReviewEntryOf({ state: s, sessionId, mountId });
      const kind: ChecksHostKind = entry?.kind ?? 'local';
      return { kind, url: entry?.url ?? null, number: entry?.number ?? null };
    }),
  );
  const canReadChecks = REVIEW_SOURCE_CAPABILITIES[host.kind].canReadChecks;
  const portHost = host.kind === 'gitlab' || host.kind === 'bitbucket' ? host.kind : null;
  const isPortHost = portHost !== null;
  const portView = usePullRequestView({
    sessionId,
    mountId,
    isEnabled: isPortHost && canReadChecks,
    fallbackNumber: host.number,
  });
  const create = useActionControls({
    target: { kind: 'pullRequest', sessionId, mountId, prNumber: null },
  });

  const pr = github?.pr ?? null;
  const detail = github?.detail ?? null;
  const analysisRequest = isPortHost ? portView.view : pr;
  const isChecking = isPortHost ? portView.isLoading : github?.detailLoading === true;
  const prNumber = pr?.number ?? null;
  const hasDetail = detail !== null && detail.prNumber === prNumber;

  useEffect(() => {
    if (prNumber === null || hasDetail) {
      return;
    }
    if (mountId === null) {
      void refreshSessionPrDetail(sessionId);
      return;
    }
    void refreshSessionPrDetail(sessionId, { mountId });
  }, [hasDetail, mountId, prNumber, refreshSessionPrDetail, sessionId]);

  const reloadPortView = portView.reload;
  const checkAgain = useCallback(() => {
    if (isPortHost) {
      reloadPortView();
      return;
    }
    void refreshSessionPrDetail(sessionId, {
      force: true,
      ...(mountId === null ? {} : { mountId }),
    });
  }, [isPortHost, mountId, refreshSessionPrDetail, reloadPortView, sessionId]);

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
    portReadFailure:
      portView.isLoading || portView.view !== null || portView.error === null
        ? null
        : { kind: portView.errorKind === 'denied' ? 'denied' : 'failed', error: portView.error },
  });

  const fallbackUrl = pr?.url ?? host.url ?? '';
  const createAction = create.actions.find((action) => action.id === CREATE_ACTION_ID);

  const stateNotice = () => {
    if (view.kind === 'host') {
      const label = REVIEW_SOURCE_LABEL[view.host];
      const HostLogo = hostIconOf({ host: view.host });
      const url = view.url;
      return (
        <EmptyState
          size="page"
          icon={CONCEPT_ICONS.checks}
          title={`No ${label} ${HOST_NOUN[view.host]} here yet`}
          description={`Goodboy doesn't read ${label} ${HOST_NOUN[view.host]} yet.`}
          action={
            url === null ? undefined : (
              <Button
                variant="ghost"
                size="sm"
                aria-label={`View on ${label}`}
                onClick={() => void openUrl(url)}
              >
                <HostLogo size={ICON_SIZE.row} aria-hidden />
                View
              </Button>
            )
          }
        />
      );
    }
    if (view.kind === 'no-pr' || (pr === null && !isPortHost)) {
      return (
        <EmptyState
          size="page"
          icon={CONCEPT_ICONS.checks}
          title="No pull request yet"
          description="Checks run once the pull request exists."
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
          host={portHost ?? 'github'}
          repoName={repoNameOf({ url: pr?.url ?? host.url ?? '' })}
          isTokenBound={connection.mode === 'pat' || hasBinding}
          isChecking={isChecking}
          error={view.error}
          onOpenSettings={() => openToolSettings({ tool: portHost ?? 'github' })}
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
          renderCheckRow={
            analysisRequest === null || repo === null
              ? undefined
              : ({ check, renderRow }) =>
                  FAILED_CONCLUSIONS.has(check.conclusion) ? (
                    <AnalyzedCheckRow
                      sessionId={sessionId}
                      mountId={repo.mountId}
                      pullRequest={analysisRequest}
                      check={check}
                      renderRow={renderRow}
                    />
                  ) : (
                    renderRow({
                      onOpen: () => void openUrl(check.detailsUrl ?? fallbackUrl),
                    })
                  )
          }
          checks={view.kind === 'ready' ? view.checks : []}
          fallbackUrl={fallbackUrl}
          host={isPortHost ? host.kind : 'github'}
          isLoading={view.kind === 'loading'}
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
