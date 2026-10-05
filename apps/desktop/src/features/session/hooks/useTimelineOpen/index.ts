import { useShowToast } from '../../../../shared/components/Toast/useShowToast';
import { dispatchAfterNavigation } from '../../../actions/dispatchAfterNavigation';
import { linkIssueEventName } from '../../../actions/kinds/session';
import { useCallback } from 'react';
import type { SessionId } from '@goodboy/types';
import type { SessionEventKind } from '@goodboy/types';
import { agentPlace, branchPlace, sessionPlace, useAppStore } from '../../../../store';
import { lensPlace } from '../../../../store/slices/navigation/canonicalLocation';
import type { LensKind } from '../../../../store/slices/session-view/types';
import type { TimelineStreamEntry } from '../../timeline/buildTimelineStream';

type EventTarget = {
  readonly lens: LensKind | null;
  readonly label: string;
};

const EVENT_TARGET: Record<SessionEventKind, EventTarget | null> = {
  worktree_created: { lens: 'files', label: 'Open files' },
  branch_created: { lens: 'files', label: 'Open files' },
  branch_switched: { lens: 'files', label: 'Open files' },
  branch_deleted: null,
  branch_restored: { lens: 'files', label: 'Open files' },
  issue_linked: { lens: null, label: 'Open overview' },
  issue_unlinked: { lens: null, label: 'Re-link' },
  pr_created: { lens: 'pr', label: 'Open PR' },
  pr_discovered: { lens: 'pr', label: 'Open PR' },
  pr_ready: { lens: 'pr', label: 'Open PR' },
  pr_approved: { lens: 'pr', label: 'Open PR' },
  pr_merged: { lens: 'pr', label: 'Open PR' },
  pr_closed: { lens: 'pr', label: 'Open PR' },
  workflow_started: { lens: 'workflows', label: 'Open workflows' },
  workflow_discarded: { lens: 'workflows', label: 'Open workflows' },
  workflow_restored: { lens: 'workflows', label: 'Open workflows' },
  workflow_closed: { lens: 'workflows', label: 'Open workflows' },
  workflow_deleted: { lens: 'workflows', label: 'Open workflows' },
  decisions_changed: { lens: 'decisions', label: 'Open decisions' },
  project_materialized: { lens: 'files', label: 'Open files' },
  project_materialization_refused: { lens: null, label: 'Open overview' },
  project_materialization_proposed: { lens: null, label: 'Open overview' },
  project_materialization_dismissed: null,
  project_detached: null,
  external_task_created: { lens: null, label: 'Open overview' },
  rebase_requested: { lens: 'agents', label: 'Open agents' },
  session_archived: null,
  session_restored: null,
  write_destination_changed: { lens: 'files', label: 'Open files' },
  question_dismissed: { lens: 'questions', label: 'Open questions' },
  question_restored: { lens: 'questions', label: 'Open questions' },
  history_rewritten: { lens: 'branch', label: 'Open commits' },
  history_pushed: { lens: 'branch', label: 'Open commits' },
  history_stopped: { lens: 'branch', label: 'Open commits' },
  history_restored: { lens: 'branch', label: 'Open commits' },
};

const eventOpenTarget = ({ kind }: { readonly kind: SessionEventKind }): EventTarget | null =>
  EVENT_TARGET[kind];

type Params = {
  readonly sessionId: SessionId;
};

export type TimelineOpenTarget = {
  readonly label: string;
  readonly open: () => void;
};

type TargetParams = {
  readonly entry: TimelineStreamEntry;
};

export const useTimelineOpen = ({
  sessionId,
}: Params): ((params: TargetParams) => TimelineOpenTarget | null) => {
  const showToast = useShowToast();
  return useCallback(
    ({ entry }: TargetParams): TimelineOpenTarget | null => {
      const store = useAppStore.getState();
      if (entry.kind === 'run') {
        return {
          label: 'Open run',
          open: () => {
            store.navigate({
              to: sessionPlace({
                sessionId,
                lens: 'workflows',
                target: { kind: 'run', runId: entry.run.id },
              }),
            });
          },
        };
      }
      if (entry.kind === 'agent') {
        const isResolver = entry.agentKind === 'resolver';
        return {
          label: isResolver ? 'Open fix run' : 'Open chat',
          open: () => {
            store.navigate({
              to: agentPlace({
                sessionId,
                agentId: entry.agent.id,
                pane: isResolver ? 'brief' : null,
              }),
            });
          },
        };
      }
      if (entry.kind === 'plan') {
        return {
          label: 'Open plan',
          open: () => {
            store.openDrawer({
              kind: 'artifact-document',
              sessionId,
              payload: { artifactId: entry.plan.id, revision: null },
            });
          },
        };
      }
      if (entry.kind === 'artifact') {
        const { artifact } = entry;
        return {
          label: artifact.kind === 'report' ? 'Open report' : 'Open wireframe',
          open: () => {
            store.navigate({
              to: sessionPlace({
                sessionId,
                lens: 'plans',
                target: { kind: 'artifact', artifactId: artifact.id },
              }),
            });
          },
        };
      }
      if (entry.kind === 'issue') {
        return {
          label: `Open ${entry.task.identifier}`,
          open: () => store.openExternalTaskLens(sessionId, entry.task),
        };
      }
      if (entry.kind === 'branch') {
        return {
          label: 'Open files',
          open: () => store.navigate({ to: lensPlace({ state: store, sessionId, lens: 'files' }) }),
        };
      }
      if (entry.kind === 'event' && entry.event.kind === 'branch_deleted') {
        const deletedBranchId = entry.event.payload?.deletedBranchId;
        if (deletedBranchId === undefined) {
          return null;
        }
        return {
          label: 'Restore',
          open: () => {
            void store
              .restoreDeletedBranch({ id: deletedBranchId })
              .catch((error: unknown) =>
                store.reportError({ title: "Couldn't restore the branch", error, sessionId }),
              );
          },
        };
      }
      if (entry.kind === 'event' && entry.event.kind === 'issue_unlinked') {
        const payload = entry.event.payload;
        const operation = payload?.taskOperation;
        return {
          label: 'Re-link',
          open: () => {
            if (operation !== undefined) {
              void store
                .relinkSessionTaskOperation({ sessionId, operation })
                .then((isRestored) => {
                  showToast({
                    kind: isRestored ? 'success' : 'info',
                    message: isRestored
                      ? `Re-linked ${payload?.identifier ?? 'task'}`
                      : 'This task changed or was re-linked. Nothing changed.',
                  });
                })
                .catch((error: unknown) =>
                  store.reportError({ title: "Couldn't re-link the task", error, sessionId }),
                );
              return;
            }
            store.navigate({ to: sessionPlace({ sessionId, lens: null }) });
            dispatchAfterNavigation({
              name: linkIssueEventName({ sessionId }),
              detail: { query: payload?.url ?? payload?.identifier ?? '' },
            });
          },
        };
      }
      if (entry.kind === 'event') {
        const target = eventOpenTarget({ kind: entry.event.kind });
        if (target == null) {
          return null;
        }
        if (entry.event.kind.startsWith('history_')) {
          const historyPath = entry.event.payload?.worktreePath ?? null;
          return {
            label: 'Open commits',
            open: () => store.openRewriteHistory(sessionId, historyPath),
          };
        }
        return {
          label: target.label,
          open: () =>
            store.navigate({ to: lensPlace({ state: store, sessionId, lens: target.lens }) }),
        };
      }
      if (entry.kind === 'learning') {
        return {
          label: 'Open learned',
          open: () => store.openContextDrawer({ sessionId, tab: 'learned' }),
        };
      }
      return {
        label: 'Open questions',
        open: () => store.navigate({ to: sessionPlace({ sessionId, lens: 'questions' }) }),
      };
    },
    [sessionId, showToast],
  );
};
