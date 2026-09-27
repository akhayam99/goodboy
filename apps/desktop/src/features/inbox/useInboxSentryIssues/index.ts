import { useEffect, useMemo, useState } from 'react';
import type { ProjectSentryLink, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../store';
import {
  useSentryIssues,
  type UseSentryIssues,
} from '../../integrations/sentry/SentryStudio/useSentryIssues';

type Params = { readonly workspaceId: WorkspaceId; readonly isEnabled: boolean };
type Result = {
  readonly sentry: UseSentryIssues;
  readonly links: ReadonlyArray<ProjectSentryLink>;
};

export const useInboxSentryIssues = ({ workspaceId, isEnabled }: Params): Result => {
  const links = useAppStore((state) => state.projectSentryLinks[workspaceId] ?? EMPTY_ARRAY);
  const hasLinks = useAppStore((state) => state.projectSentryLinks[workspaceId] != null);
  const loadProjectSentryLinks = useAppStore((state) => state.loadProjectSentryLinks);
  const [failedFor, setFailedFor] = useState<WorkspaceId | null>(null);
  useEffect(() => {
    if (!isEnabled) {
      return;
    }
    void loadProjectSentryLinks({ workspaceId }).catch(() => setFailedFor(workspaceId));
  }, [isEnabled, loadProjectSentryLinks, workspaceId]);
  const linkedProjects = useMemo(() => links.map((link) => link.sentryProject), [links]);
  const sentry = useSentryIssues(
    workspaceId,
    isEnabled,
    linkedProjects,
    hasLinks || failedFor === workspaceId,
  );
  return { sentry, links };
};
