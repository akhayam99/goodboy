import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { GitlabIntegrationBinding, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../store';
import { sentryListCodeMappings, type SentryCodeMapping } from '../../integrations/sentry/client';
import { launchMountFor, type LaunchMount, type LaunchMountSource } from '../launchMountFor';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly source: LaunchMountSource | null;
};

type MappingsParams = {
  readonly workspaceId: WorkspaceId;
};

const NO_MAPPINGS: ReadonlyArray<SentryCodeMapping> = [];

const mappingsCache = new Map<WorkspaceId, Promise<ReadonlyArray<SentryCodeMapping>>>();

const mappingsOf = ({ workspaceId }: MappingsParams): Promise<ReadonlyArray<SentryCodeMapping>> => {
  const cached = mappingsCache.get(workspaceId);
  if (cached !== undefined) {
    return cached;
  }
  const pending = sentryListCodeMappings({ workspaceId })
    .then((list) => (Array.isArray(list) ? list : NO_MAPPINGS))
    .catch(() => {
      mappingsCache.delete(workspaceId);
      return NO_MAPPINGS;
    });
  mappingsCache.set(workspaceId, pending);
  return pending;
};

export const useLaunchMount = ({ workspaceId, source }: Params): LaunchMount | null => {
  const provider = source?.provider ?? null;
  const url = source?.url ?? '';
  const sentryProject = source?.sentryProject ?? null;
  const isSentry = provider === 'sentry';
  const projects = useAppStore(
    useShallow((state) =>
      state.projects.filter(
        (project) =>
          project.workspaceId === workspaceId &&
          project.kind === 'repo' &&
          project.disconnectedAt == null,
      ),
    ),
  );
  const links = useAppStore((state) => state.projectSentryLinks[workspaceId] ?? EMPTY_ARRAY);
  const gitlabHosts = useAppStore(
    useShallow((state) =>
      (state.workspaceIntegrations[workspaceId] ?? [])
        .filter((binding): binding is GitlabIntegrationBinding => binding.provider === 'gitlab')
        .map((binding) => binding.config.host),
    ),
  );
  const [mappings, setMappings] = useState<ReadonlyArray<SentryCodeMapping>>(NO_MAPPINGS);

  useEffect(() => {
    if (!isSentry) {
      return;
    }
    let isCurrent = true;
    void mappingsOf({ workspaceId }).then((list) => {
      if (isCurrent) {
        setMappings(list);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [isSentry, workspaceId]);

  return useMemo(
    () =>
      provider === null
        ? null
        : launchMountFor({
            source: { provider, url, sentryProject },
            projects,
            links,
            mappings,
            gitlabHosts,
          }),
    [gitlabHosts, links, mappings, projects, provider, sentryProject, url],
  );
};
