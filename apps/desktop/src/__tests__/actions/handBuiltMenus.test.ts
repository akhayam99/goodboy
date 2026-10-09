// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');
const SCANNED_ROOTS = ['features', 'app', 'shared'];
const REGISTRY_ROOT = 'features/actions/';

const HAND_BUILT_MENU = /OverflowMenuItem|<OverflowMenu\b|<MenuItems\b|<MenuList\b|<ContextMenu\b/;

const ALLOWED: Readonly<Record<string, string>> = {
  'features/artifacts/components/ArtifactList/ArtifactListOverflowMenu.tsx':
    'list header menu (open the artifacts folder), not an object in the map',
  'features/branch/components/BranchHeader/BranchOverflow.tsx':
    'branch header menu: its entries come from the pull request and diff kinds of the registry',
  'features/artifacts/components/ArtifactDocumentDrawer/PlanDrawerMenu.tsx':
    'plan drawer chrome: Open in Artifacts and Expand belong to the drawer, Copy markdown runs artifact.copySource',
  'features/resolve/notes/components/ReviewNotesDrawer/ReviewNotesMenu.tsx':
    'notes drawer chrome: Show closed belongs to the drawer, Move to review draft runs review.postNotes',
  'features/artifacts/components/ArtifactList/ArtifactNewMenu.tsx':
    'creation menu: picks the kind of artifact to create',
  'features/session/components/SessionOverviewPane/OverviewActions/index.tsx':
    'Create split menu: picks what to create',
  'features/integrations/linear/LinearAssigneeMenu.tsx':
    'property picker: sets the assignee value from the control that shows it',
  'features/integrations/linear/LinearStateMenu.tsx':
    'property picker: sets the state value from the control that shows it',
  'features/providers/components/ProviderStudio/DefaultsPanel/index.tsx':
    'settings control, not an object in the map',
  'features/providers/components/ProviderStudio/ProviderPage/ProviderPageBody.tsx':
    'settings control, not an object in the map',
  'features/settings/components/SettingsStudio/WorkspaceFieldRow.tsx':
    'settings field menu (Reset to the default), not an object in the map',
  'features/settings/components/SettingsStudio/WorkspaceScopePanel.tsx':
    'settings page menu (Restore defaults, Copy from), page chrome',
  'features/wireframes/components/WireframeViewer/RevisionPicker.tsx':
    'revision picker inside the wireframe viewer',
  'features/workflows/components/StepTree/StepEditorMenu.tsx':
    'step draft actions inside the step editor, a draft is not an object in the map',
  'features/workflows/components/RunControls/RunControlMenu.tsx':
    'run control: when to ask and model routing, not an object in the map',
  'features/workflows/components/WorkflowStudio/WorkflowEditor/EditorTrail.tsx':
    'workflow editor band actions, studio chrome',
  'features/workflows/components/WorkflowStudio/WorkflowList/index.tsx':
    'workflow library list menu (restore built-ins); the workflow kind is a follow-up',
  'features/history/components/CommitsHistory/HistoryActions.tsx':
    'commits tab menu (terminal), tab chrome',
  'features/search/components/SearchMode/SearchHitActions.tsx':
    'search preview: lists the registry verbs of the hit through toMenuEntries',
  'features/storage/components/StoragePage/ArtifactRowActions.tsx':
    'artifact files from deleted sessions: storage keep and delete',
  'features/session/components/TaskPlacement/PutOnBranchPopover.tsx':
    'task picker: chooses a linked task for a branch, a value picker',
  'features/session/components/SessionOverviewPane/ProjectMountRows/MountProjectAction.tsx':
    'Projects section menu: Add project once nothing is left to add, section chrome',
  'features/session/components/SessionOverviewPane/UnassignedNote.tsx':
    'Discard on a note written before notes belonged to a branch, which has no object in the map',
  'features/session/components/SessionWorkspace/parts/TimelinePane/index.tsx':
    'Activity header menu: Mark all seen acts on the feed, not on an object in the map',
};

const isSource = (path: string): boolean =>
  /\.(ts|tsx)$/.test(path) &&
  !/\.test\.(ts|tsx)$/.test(path) &&
  !path.includes(`${sep}__tests__${sep}`);

const walk = (dir: string): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return walk(path);
    }
    return isSource(path) ? [path] : [];
  });

const offenders = (): ReadonlyArray<string> =>
  SCANNED_ROOTS.flatMap((root) => walk(join(SRC, root)))
    .map((path) => relative(SRC, path).split(sep).join('/'))
    .filter((path) => !path.startsWith(REGISTRY_ROOT))
    .filter((path) => HAND_BUILT_MENU.test(readFileSync(join(SRC, path), 'utf8')));

describe('object menus come from the action registry', () => {
  it('builds no menu by hand outside the registry, except the listed non-object menus', () => {
    expect(offenders().filter((path) => ALLOWED[path] === undefined)).toEqual([]);
  });

  it('keeps the allowlist shrinking: every entry still builds a menu by hand', () => {
    const found = new Set(offenders());
    expect(Object.keys(ALLOWED).filter((path) => !found.has(path))).toEqual([]);
  });
});
