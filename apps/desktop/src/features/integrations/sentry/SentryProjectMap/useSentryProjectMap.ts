import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { IntegrationCredentialId, ProjectSentryLink, WorkspaceId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import {
  sentryListCodeMappings,
  sentryListProjects,
  type SentryCodeMapping,
  type SentryProjectSummary,
} from '../client';
import { suggestLinks } from './suggestLinks';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly credentialId: IntegrationCredentialId;
  readonly org: string;
};

export const useSentryProjectMap = ({ workspaceId, credentialId, org }: Params) => {
  const projects = useAppStore(
    useShallow((state) =>
      state.projects.filter(
        (project) => project.workspaceId === workspaceId && project.disconnectedAt == null,
      ),
    ),
  );
  const links: ReadonlyArray<ProjectSentryLink> = useAppStore(
    (state) => state.projectSentryLinks[workspaceId] ?? EMPTY_ARRAY,
  );
  const loadProjectSentryLinks = useAppStore((state) => state.loadProjectSentryLinks);
  const [sentryProjects, setSentryProjects] = useState<ReadonlyArray<SentryProjectSummary>>([]);
  const [mappings, setMappings] = useState<ReadonlyArray<SentryCodeMapping>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    void loadProjectSentryLinks({ workspaceId }).catch((loadError: unknown) => {
      if (isCurrent) {
        setError(formatError(loadError));
      }
    });
    void sentryListProjects({ credentialId, token: null, org })
      .then((list) => {
        if (isCurrent) {
          setSentryProjects(Array.isArray(list) ? list : []);
        }
      })
      .catch((listError: unknown) => {
        if (isCurrent) {
          setError(formatError(listError));
        }
      });
    void sentryListCodeMappings({ workspaceId })
      .then((list) => {
        if (isCurrent) {
          setMappings(Array.isArray(list) ? list : []);
        }
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [credentialId, loadProjectSentryLinks, org, workspaceId]);

  const suggestions = useMemo(
    () => suggestLinks({ projects, mappings, links }),
    [links, mappings, projects],
  );

  return { projects, links, sentryProjects, suggestions, error };
};
