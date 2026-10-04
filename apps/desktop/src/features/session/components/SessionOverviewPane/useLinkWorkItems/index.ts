import { useMemo } from 'react';
import type { SessionExternalTaskProvider, SessionId, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { launchSpecFor } from '../../../../inbox/launchSpecFor';
import { useInboxRecords } from '../../../../inbox/useInboxRecords';
import { useWorkspaceIssueLookup } from '../../../../integrations/hooks/useWorkspaceIssueLookup';
import { primaryProjectRoot } from '../../../../workspace/primaryProjectRoot';
import type { LinkScope } from '../linkScope';
import { taskKey, type LinkedScopes, type LinkWorkItem } from '../linkWorkRows';

type Params = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly query: string;
};

type Result = {
  readonly items: ReadonlyArray<LinkWorkItem>;
  readonly lookedUp: ReadonlyArray<LinkWorkItem>;
  readonly linkedScopes: LinkedScopes;
  readonly sources: ReadonlyArray<SessionExternalTaskProvider>;
  readonly isLoading: boolean;
};

export const useLinkWorkItems = ({ sessionId, workspaceId, query }: Params): Result => {
  const rootPath = useAppStore((state) =>
    primaryProjectRoot({ projects: state.projects, workspaceId }),
  );
  const inbox = useInboxRecords({ workspaceId, rootPath: rootPath ?? '' });
  const lookup = useWorkspaceIssueLookup({ workspaceId, query });
  const linked = useAppStore((state) => state.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY);
  const onBoard = useAppStore((state) => state.workspaceExternalTasks[workspaceId] ?? EMPTY_ARRAY);

  const items = useMemo(
    () =>
      inbox.records.flatMap((record): ReadonlyArray<LinkWorkItem> => {
        const spec = launchSpecFor({ record });
        if (spec === null) {
          return [];
        }
        return [
          {
            key: taskKey({ task: spec.externalTask }),
            task: spec.externalTask,
            status: record.stateLabel,
            updatedAt: record.updatedAt,
          },
        ];
      }),
    [inbox.records],
  );

  const lookedUp = useMemo(
    () =>
      (lookup.settled?.hits ?? []).map((hit): LinkWorkItem => {
        const task = {
          provider: hit.candidate.provider,
          externalId: hit.candidate.externalId,
          identifier: hit.candidate.identifier,
          url: hit.candidate.url,
          title: hit.candidate.title,
        };
        return {
          key: taskKey({ task }),
          task,
          status: hit.record.stateLabel,
          updatedAt: hit.record.updatedAt,
        };
      }),
    [lookup.settled],
  );

  const linkedScopes = useMemo(() => {
    const scopes = new Map<string, ReadonlyArray<LinkScope>>();
    const add = (key: string, scope: LinkScope): void => {
      const current = scopes.get(key) ?? [];
      if (!current.includes(scope)) {
        scopes.set(key, [...current, scope]);
      }
    };
    linked.forEach((task) => add(taskKey({ task }), 'session'));
    onBoard.forEach((task) => add(taskKey({ task }), 'workspace'));
    return scopes;
  }, [linked, onBoard]);

  return {
    items,
    lookedUp,
    linkedScopes,
    sources: inbox.connected,
    isLoading: inbox.isLoading || lookup.loadingProviders.length > 0,
  };
};
