import { useEffect, useMemo } from 'react';
import type { SessionExternalTaskProvider, SessionId, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { launchSpecFor } from '../../../../inbox/launchSpecFor';
import { useInboxRecords } from '../../../../inbox/useInboxRecords';
import { useWorkspaceIssueLookup } from '../../../../integrations/hooks/useWorkspaceIssueLookup';
import { primaryProjectRoot } from '../../../../workspace/primaryProjectRoot';
import { starKey } from '../../../../integrations/starred/starredIssueOf';
import { taskKey, type LinkedKeys, type LinkWorkItem } from '../linkWorkRows';

type Params = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly query: string;
};

type Result = {
  readonly items: ReadonlyArray<LinkWorkItem>;
  readonly lookedUp: ReadonlyArray<LinkWorkItem>;
  readonly linkedKeys: LinkedKeys;
  readonly starredKeys: ReadonlySet<string>;
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
  const starred = useAppStore((state) => state.starredIssues[workspaceId] ?? EMPTY_ARRAY);
  const loadStarredIssues = useAppStore((state) => state.loadStarredIssues);
  const reportError = useAppStore((state) => state.reportError);

  useEffect(() => {
    loadStarredIssues({ workspaceId }).catch((error: unknown) => {
      void reportError({ title: "Couldn't load starred issues", error, workspaceId });
    });
  }, [loadStarredIssues, reportError, workspaceId]);

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

  const linkedKeys = useMemo(() => new Set(linked.map((task) => taskKey({ task }))), [linked]);

  const starredKeys = useMemo(() => new Set(starred.map((issue) => starKey(issue))), [starred]);

  return {
    items,
    lookedUp,
    linkedKeys,
    starredKeys,
    sources: inbox.connected,
    isLoading: inbox.isLoading || lookup.loadingProviders.length > 0,
  };
};
