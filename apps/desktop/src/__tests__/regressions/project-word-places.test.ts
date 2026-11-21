// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NO_INBOX_FILTERS } from '../../features/inbox/kindFilter';
import { projectFilterNote, projectFilterScope } from '../../features/inbox/projectFilterScope';
import { TASK_GROUP_BY_LABEL } from '../../features/inbox/taskGroups';
import { productSources } from './scanControls';

const FOLDER_AS_PROJECT =
  /(['"`])(?:No )?[Ff]olders?\1|\b(?:Search|Other|No) folders\b|\bFolder filter\b/;

const PLACES: ReadonlyArray<string> = [
  'apps/desktop/src/features/inbox/taskGroups.ts',
  'apps/desktop/src/features/inbox/projectFilterScope.ts',
  'apps/desktop/src/features/inbox/components/InboxStudio/InboxProjectFacets.tsx',
  'apps/desktop/src/features/inbox/components/InboxStudio/TasksGroupByMenu.tsx',
  'apps/desktop/src/store/slices/session-view/sortAndGroupSessions.ts',
  'apps/desktop/src/features/workspace/hooks/useProjectFilterOptions/index.ts',
  'apps/desktop/src/shared/components/ProjectPicker/index.tsx',
  'apps/desktop/src/shared/components/ProjectLinkList/ProjectGroups.tsx',
  'apps/desktop/src/features/session/components/SessionKickoff/WhereChip/index.tsx',
  'apps/desktop/src/features/session/components/SessionOverviewPane/ProjectMountRows/MountProjectList.tsx',
];

describe('a repository is a project in every filter, group and facet', () => {
  it.each(PLACES)('%s says project, never folder, for a project', (path) => {
    const source = productSources().find((file) => file.path === path);
    expect(source, `${path} moved: update the list of places`).toBeDefined();
    expect(source?.text.match(FOLDER_AS_PROJECT)?.[0] ?? null).toBeNull();
  });

  it('groups Tasks by Project', () => {
    expect(TASK_GROUP_BY_LABEL.project).toBe('Project');
  });

  it('names the project filter in its note', () => {
    const scope = projectFilterScope({
      connected: ['linear', 'sentry'],
      filters: NO_INBOX_FILTERS,
    });
    expect(projectFilterNote({ scope })).toMatch(/^Project filter applies to Sentry\./);
  });
});
