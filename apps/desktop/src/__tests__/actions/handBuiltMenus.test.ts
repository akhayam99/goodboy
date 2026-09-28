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
  'features/artifacts/components/ArtifactList/ArtifactNewMenu.tsx':
    'creation menu: picks the kind of artifact to create',
  'features/session/components/SessionOverviewPane/OverviewActions/index.tsx':
    'Create split menu: picks what to create',
  'features/session/components/SessionOverviewPane/OverviewActions/useArtifactCreateItems/index.ts':
    'Create split menu items: picks what to create',
  'features/session/components/SessionSetup/WorkStep.tsx':
    'setup step: picks how to start the work',
  'features/integrations/linear/LinearAssigneeMenu/index.tsx':
    'property picker: sets the assignee value from the control that shows it',
  'features/integrations/linear/LinearStateMenu/index.tsx':
    'property picker: sets the state value from the control that shows it',
  'features/providers/components/ProviderStudio/DefaultsPanel/index.tsx':
    'settings control, not an object in the map',
  'features/providers/components/ProviderStudio/ProviderPage/ProviderPageBody.tsx':
    'settings control, not an object in the map',
  'features/wireframes/components/WireframeViewer/RevisionPicker.tsx':
    'revision picker inside the wireframe viewer',
  'features/workflows/components/OrchestratorStrip/OrchestratorMenu.tsx':
    'orchestrator strip control with its own in-place confirm',
  'features/workflows/components/WorkflowStudio/WorkflowEditor/EditorTrail.tsx':
    'workflow editor band actions, studio chrome',
  'features/workflows/components/WorkflowStudio/WorkflowList/index.tsx':
    'workflow library list menu (restore built-ins); the workflow kind is a follow-up',
  'features/history/components/RewriteHistoryPage/index.tsx':
    'rewrite page menu (backups, terminal), page chrome',
  'features/history/useHistoryRowActions/index.ts':
    'rewrite event rows in Activity: event verbs, not an object in the map',
  'features/session/components/SessionWorkspace/parts/TimelinePane/index.tsx':
    'hosts the rewrite event menu of useHistoryRowActions',
  'features/storage/components/StoragePage/ArtifactRowActions.tsx':
    'artifact files from deleted sessions: storage keep and delete',
  'features/resolve/components/ResolvePanelHeader/index.tsx':
    'Review conversation menu; the conversation kind lands with ux5-review on this registry',
  'features/resolve/components/ResolveQueueHome/index.tsx':
    'Review queue header menu; the conversation kind lands with ux5-review on this registry',
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
