// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from '../../shared/navigation/destinations';

const SRC_ROOT = join(__dirname, '..', '..');
const SKIP_SEGMENTS = new Set(['__tests__', 'node_modules', 'dist']);

const EVENT_NAME = 'goodboy:open-notifications-studio';
const EVENT_CONSTANT = 'NOTIFICATIONS_STUDIO_EVENT';
const STUDIO_COMPONENT = 'NotificationsStudio';

const BELL_FILE = 'features/notifications/components/NotificationCenter/index.tsx';
const PALETTE_FILE = 'features/palette/hooks/useCommandEntries.ts';
const MENU_BAR_FILE = 'app/hooks/useMenuCommands/menuActions.ts';
const DISPATCHER_FILES = [BELL_FILE];
const NOTIFICATIONS_MENU_ID = 'menu.notifications';
const EVENT_LISTENER_FILE = 'app/hooks/useAppOverlays/useStudioEvents.ts';
const MOUNT_FILE = 'app/components/AppOverlayRouter/renderStudio.tsx';

function listSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_SEGMENTS.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      listSourceFiles(full, acc);
    } else if (
      (entry.endsWith('.ts') || entry.endsWith('.tsx')) &&
      !entry.endsWith('.test.ts') &&
      !entry.endsWith('.test.tsx') &&
      !entry.endsWith('.d.ts')
    ) {
      acc.push(full);
    }
  }
  return acc;
}

type Hit = {
  readonly file: string;
  readonly line: number;
  readonly snippet: string;
};

function scan(path: string, matches: (line: string) => boolean): Hit[] {
  const content = readFileSync(path, 'utf-8');
  const file = relative(SRC_ROOT, path).split(sep).join('/');
  const hits: Hit[] = [];
  content.split('\n').forEach((line, index) => {
    if (!matches(line)) {
      return;
    }
    hits.push({ file, line: index + 1, snippet: line.trim().slice(0, 140) });
  });
  return hits;
}

function format(hits: ReadonlyArray<Hit>): string {
  return hits.map((hit) => `  - ${hit.file}:${hit.line}\n      ${hit.snippet}`).join('\n');
}

const referencesEvent = (line: string): boolean =>
  line.includes(EVENT_CONSTANT) || line.includes(EVENT_NAME);

const isDispatch = (line: string): boolean =>
  referencesEvent(line) && (line.includes('dispatchEvent') || line.includes('dispatchWindowEvent'));

const mountsStudio = (line: string): boolean => line.includes(`<${STUDIO_COMPONENT}`);

const opensNotificationsDestination = (line: string): boolean =>
  line.includes("id: 'notifications'") && line.includes('destinationAction');

const readsDestinationList = (line: string): boolean => line.includes('DESTINATIONS');

const opensDestination = (line: string): boolean =>
  line.includes('openDestination({') || line.includes('runDestination({');

describe('the notifications studio has three entrances, the bell, the palette and the menu bar', () => {
  const files = listSourceFiles(SRC_ROOT);

  it('the destination list holds one notifications entry, in the top bar, with no shortcut', () => {
    const entries = DESTINATIONS.filter((destination) => destination.id === 'notifications');

    expect(entries).toHaveLength(1);
    expect(entries[0]?.home).toBe('topBar');
    expect(entries[0]?.shortcutId).toBeUndefined();
    expect(entries[0]?.menuId).toBe(NOTIFICATIONS_MENU_ID);
    expect(DESTINATIONS.filter((destination) => destination.home === 'foot')).not.toContainEqual(
      expect.objectContaining({ id: 'notifications' }),
    );
  });

  it('the palette reaches the studio through the destination list and the menu bar through its menu action', () => {
    const paletteReadsList = scan(join(SRC_ROOT, PALETTE_FILE), readsDestinationList);
    const paletteOpens = scan(join(SRC_ROOT, PALETTE_FILE), opensDestination);
    const menuBar = files.flatMap((path) => scan(path, opensNotificationsDestination));

    expect(paletteReadsList.length).toBeGreaterThan(0);
    expect(paletteOpens.length).toBeGreaterThan(0);
    expect(menuBar.map((hit) => hit.file)).toEqual([MENU_BAR_FILE]);
  });

  it('only the bell dispatches the open event', () => {
    const dispatchers = files.flatMap((path) => scan(path, isDispatch));
    const dispatcherFiles = [...new Set(dispatchers.map((hit) => hit.file))].sort();

    if (
      dispatchers.length !== DISPATCHER_FILES.length ||
      dispatcherFiles.join(',') !== [...DISPATCHER_FILES].sort().join(',')
    ) {
      throw new Error(
        `The notifications studio opens from the bell popover header, the command ` +
          `palette and Go > Notifications in the macOS menu bar. The palette and the menu bar ` +
          `go through openDestination, so only ${DISPATCHER_FILES.join(' and ')} may dispatch ` +
          `${EVENT_NAME}, once. Found ${dispatchers.length} dispatcher(s). Do not add a ` +
          `footer entry or a keyboard shortcut for it.\n\n${format(dispatchers)}`,
      );
    }
    expect(dispatcherFiles).toEqual([...DISPATCHER_FILES].sort());
  });

  it('only AppOverlayRouter mounts the studio', () => {
    const mounts = files.flatMap((path) => scan(path, mountsStudio));

    if (mounts.length !== 1 || mounts[0]?.file !== MOUNT_FILE) {
      throw new Error(
        `${STUDIO_COMPONENT} is a full-page studio owned by the app shell, so only ` +
          `${MOUNT_FILE} may mount it. Found ${mounts.length} mount(s).\n\n${format(mounts)}`,
      );
    }
    expect(mounts).toHaveLength(1);
  });

  it('nothing outside the bell and the app shell references the open event', () => {
    const referrers = files.flatMap((path) => scan(path, referencesEvent));
    const unexpected = referrers.filter(
      (hit) =>
        !DISPATCHER_FILES.includes(hit.file) &&
        hit.file !== EVENT_LISTENER_FILE &&
        hit.file !== 'features/notifications/studioEvent.ts' &&
        hit.file !== 'shared/lib/dispatchWindowEvent/windowEvents.ts',
    );

    if (unexpected.length > 0) {
      throw new Error(
        `Only the bell (${BELL_FILE}), the app overlay hook (${EVENT_LISTENER_FILE}), and the event ` +
          `declaration may reference ${EVENT_NAME}. Found ${unexpected.length} other ` +
          `reference(s).\n\n${format(unexpected)}`,
      );
    }
    expect(unexpected).toEqual([]);
  });
});
