import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = join(__dirname, '..', '..');
const SKIP_SEGMENTS = new Set(['__tests__', 'node_modules', 'dist']);

const EVENT_NAME = 'goodboy:open-notifications-studio';
const EVENT_CONSTANT = 'NOTIFICATIONS_STUDIO_EVENT';
const STUDIO_COMPONENT = 'NotificationsStudio';

const DISPATCHER_FILE = 'features/notifications/components/NotificationCenter/index.tsx';
const EVENT_LISTENER_FILE = 'app/hooks/useAppOverlays/index.ts';
const MOUNT_FILE = 'app/components/AppOverlayRouter/index.tsx';

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
  referencesEvent(line) && line.includes('dispatchEvent');

const mountsStudio = (line: string): boolean => line.includes(`<${STUDIO_COMPONENT}`);

describe('the notifications studio has exactly one entrance', () => {
  const files = listSourceFiles(SRC_ROOT);

  it('only the bell dispatches the open event', () => {
    const dispatchers = files.flatMap((path) => scan(path, isDispatch));

    if (dispatchers.length !== 1 || dispatchers[0]?.file !== DISPATCHER_FILE) {
      throw new Error(
        `The notifications studio must be reachable only from the bell popover, so ` +
          `exactly one place may dispatch ${EVENT_NAME}, and it must be ` +
          `${DISPATCHER_FILE}. Found ${dispatchers.length} dispatcher(s). Do not add a ` +
          `footer entry, a keyboard shortcut, or a command palette entry for it.\n\n` +
          `${format(dispatchers)}`,
      );
    }
    expect(dispatchers).toHaveLength(1);
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
        hit.file !== DISPATCHER_FILE &&
        hit.file !== EVENT_LISTENER_FILE &&
        hit.file !== 'features/notifications/studioEvent.ts',
    );

    if (unexpected.length > 0) {
      throw new Error(
        `Only the bell (${DISPATCHER_FILE}), the app overlay hook (${EVENT_LISTENER_FILE}), and the event ` +
          `declaration may reference ${EVENT_NAME}. Found ${unexpected.length} other ` +
          `reference(s).\n\n${format(unexpected)}`,
      );
    }
    expect(unexpected).toEqual([]);
  });
});
