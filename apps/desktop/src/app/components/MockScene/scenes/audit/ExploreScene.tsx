import { useEffect, useState } from 'react';
import { mockIPC } from '@tauri-apps/api/mocks';
import { ExplorePane } from '../../../../../features/explore/components/ExplorePane';
import { ShellFrame, seedShellChrome } from '../shellChrome';
import { SESSION, SESSION_ID, seedArtifactScene } from '../artifactSeed';
import { payloadString } from './ipcPayload';
import { sceneParam, sceneParamList } from './sceneParams';
import { SCRATCH_DIR, isExploreRoots, seedExploreRoots, type ExploreRoots } from './exploreRoots';
import { useSceneClicks } from './useSceneClicks';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-09-14T16:40:00.000Z' });

const NOW = clock.iso({ at: '2026-09-14T16:40:00.000Z' });
const BIG_COUNT = 3000;

const AGES: ReadonlyArray<string> = [
  '2026-09-14T15:40:00.000Z',
  '2026-09-14T02:40:00.000Z',
  '2026-09-12T16:40:00.000Z',
  '2026-09-08T16:40:00.000Z',
];

type EntryParams = {
  readonly relPath: string;
  readonly isDir?: boolean;
  readonly sizeBytes?: number;
  readonly age?: number;
};

const entry = ({ relPath, isDir = false, sizeBytes = 0, age = 0 }: EntryParams) => ({
  name: relPath.slice(relPath.lastIndexOf('/') + 1),
  relPath,
  isDir,
  sizeBytes,
  modifiedAt: clock.iso({ at: AGES[age % AGES.length] ?? AGES[0] ?? '' }),
});

const folder = (relPath: string, age = 0) => entry({ relPath, isDir: true, age });

const ROOT = [
  folder('apps'),
  folder('docs', 1),
  folder('src', 2),
  entry({ relPath: 'README.md', sizeBytes: 3180, age: 1 }),
  entry({ relPath: 'package.json', sizeBytes: 1204, age: 0 }),
  entry({ relPath: 'pnpm-lock.yaml', sizeBytes: 482113, age: 3 }),
  entry({ relPath: 'tsconfig.json', sizeBytes: 612, age: 3 }),
];

const FOLDERS: Readonly<Record<string, ReadonlyArray<ReturnType<typeof entry>>>> = {
  apps: [folder('apps/ledger-core'), folder('apps/notify-relay', 1)],
  'apps/ledger-core': [
    entry({ relPath: 'apps/ledger-core/package.json', sizeBytes: 902 }),
    entry({ relPath: 'apps/ledger-core/schema.sql', sizeBytes: 14820, age: 2 }),
  ],
  'apps/notify-relay': [entry({ relPath: 'apps/notify-relay/package.json', sizeBytes: 871 })],
  docs: [
    entry({ relPath: 'docs/settlement-rules.md', sizeBytes: 9412, age: 1 }),
    entry({ relPath: 'docs/rounding-notes.md', sizeBytes: 2140 }),
    entry({ relPath: 'docs/ledger-diagram.png', sizeBytes: 218331, age: 3 }),
  ],
  src: [folder('src/settlement'), entry({ relPath: 'src/index.ts', sizeBytes: 388, age: 2 })],
  'src/settlement': [
    entry({ relPath: 'src/settlement/rounding.ts', sizeBytes: 4120 }),
    entry({ relPath: 'src/settlement/rounding.test.ts', sizeBytes: 2764, age: 1 }),
    entry({ relPath: 'src/settlement/batches.csv', sizeBytes: 482113, age: 2 }),
  ],
};

const NOTIFY_ROOT = [
  folder('docs', 1),
  folder('src', 2),
  entry({ relPath: 'README.md', sizeBytes: 2410, age: 1 }),
  entry({ relPath: 'package.json', sizeBytes: 988, age: 0 }),
  entry({ relPath: 'retry-policy.md', sizeBytes: 5320, age: 2 }),
];

const NOTIFY_FOLDERS: Readonly<Record<string, ReadonlyArray<ReturnType<typeof entry>>>> = {
  docs: [entry({ relPath: 'docs/delivery-states.md', sizeBytes: 3880, age: 1 })],
  src: [
    entry({ relPath: 'src/deliveries.ts', sizeBytes: 6120 }),
    entry({ relPath: 'src/retry.ts', sizeBytes: 2764, age: 1 }),
  ],
};

const NODE_MODULES = Array.from({ length: BIG_COUNT }, (_, index) =>
  entry({
    relPath: `node_modules/pkg-${String(index).padStart(4, '0')}.js`,
    sizeBytes: 1024 + index * 7,
    age: index,
  }),
);

const BRIEF = `# Settlement rounding

Northwind finance sees one cent drift on split batches.

- ledger-core rounds each posting
- the backfill must stay in dry run until totals match
`;

type ListParams = {
  readonly sessionDir: string;
  readonly relPath: string;
  readonly variant: string;
  readonly isBig: boolean;
};

const listFolder = ({ sessionDir, relPath, variant, isBig }: ListParams) => {
  if (variant === 'error') {
    throw new Error('Permission denied reading the session folder');
  }
  if (variant === 'empty') {
    return [];
  }
  if (sessionDir.includes('notify-relay')) {
    return relPath === '' ? NOTIFY_ROOT : (NOTIFY_FOLDERS[relPath] ?? []);
  }
  if (relPath === '') {
    return isBig ? [...ROOT, folder('node_modules', 3)] : ROOT;
  }
  if (relPath === 'node_modules') {
    return NODE_MODULES;
  }
  return FOLDERS[relPath] ?? [];
};

type HoverLabelParams = {
  readonly row: string;
  readonly action: string;
};

const hoverLabel = ({ row, action }: HoverLabelParams): string => {
  if (action === 'open') {
    return `Open ${row}`;
  }
  if (action === 'show') {
    return `Show ${row} in Finder`;
  }
  return `Ask an agent about ${row}`;
};

type RowHoverParams = {
  readonly isReady: boolean;
  readonly row: string | null;
  readonly action: string;
};

const useRowHover = ({ isReady, row, action }: RowHoverParams): void => {
  useEffect(() => {
    if (!isReady || row === null) {
      return;
    }
    const label = hoverLabel({ row, action });
    const interval = window.setInterval(() => {
      const target = window.document.querySelector(`button[aria-label="${CSS.escape(label)}"]`);
      if (!(target instanceof HTMLElement)) {
        return;
      }
      target.focus();
      window.clearInterval(interval);
    }, 250);
    return () => window.clearInterval(interval);
  }, [action, isReady, row]);
};

type RowFocusParams = {
  readonly isReady: boolean;
  readonly row: string | null;
};

const useRowFocus = ({ isReady, row }: RowFocusParams): void => {
  useEffect(() => {
    if (!isReady || row === null) {
      return;
    }
    const interval = window.setInterval(() => {
      const target = [...window.document.querySelectorAll('[role="treeitem"]')].find(
        (candidate) => candidate.getAttribute('aria-label') === row,
      );
      if (!(target instanceof HTMLElement)) {
        return;
      }
      target.focus();
      window.clearInterval(interval);
    }, 250);
    return () => window.clearInterval(interval);
  }, [isReady, row]);
};

type Props = {
  readonly variant?: string;
  readonly openLabels?: ReadonlyArray<string>;
  readonly hoverRow?: string | null;
  readonly hoverAction?: string;
  readonly focusRow?: string | null;
  readonly isBig?: boolean;
  readonly widthPx?: number | null;
  readonly roots?: ExploreRoots;
};

const rootsParam = (): ExploreRoots => {
  const value = sceneParam({ key: 'roots' });
  return isExploreRoots(value) ? value : 'single';
};

export const ExploreScene = (props: Props) => {
  const [isReady, setIsReady] = useState(false);
  const [resolved] = useState(() => ({
    variant: props.variant ?? sceneParam({ key: 'v' }) ?? 'populated',
    openLabels: props.openLabels ?? sceneParamList({ key: 'open', separator: ',' }),
    hoverRow: props.hoverRow ?? sceneParam({ key: 'hover' }),
    hoverAction: props.hoverAction ?? sceneParam({ key: 'tip' }) ?? 'ask',
    focusRow: props.focusRow ?? sceneParam({ key: 'focus' }),
    isBig: props.isBig ?? sceneParam({ key: 'big' }) === '1',
    widthPx: props.widthPx ?? null,
    roots: props.roots ?? rootsParam(),
  }));
  const { variant, openLabels, hoverRow, hoverAction, focusRow, isBig, widthPx, roots } = resolved;

  useEffect(() => {
    mockIPC((cmd, payload) => {
      if (cmd === 'explore_list') {
        return listFolder({
          sessionDir: payloadString({ payload, key: 'sessionDir' }) ?? '',
          relPath: payloadString({ payload, key: 'relPath' }) ?? '',
          variant,
          isBig,
        });
      }
      if (cmd === 'scratch_dir_prepare') {
        if (roots === 'none') {
          throw new Error('The scratch folder is not available');
        }
        return SCRATCH_DIR;
      }
      if (cmd === 'explore_read') {
        return { type: 'text', text: BRIEF, truncated: false };
      }
      return null;
    });
    seedArtifactScene({ focusedArtifactId: null });
    seedShellChrome({
      session: SESSION,
      siblings: [],
      branches: {},
      telemetryAt: NOW,
      lens: 'explore',
    });
    seedExploreRoots({ roots });
    setIsReady(true);
  }, [isBig, roots, variant]);

  useSceneClicks({
    isReady,
    labels: openLabels,
    selector: 'button, [role="treeitem"]',
    match: 'prefix',
    intervalMs: 250,
  });

  useRowHover({ isReady, row: hoverRow, action: hoverAction });
  useRowFocus({ isReady, row: focusRow });

  if (!isReady) {
    return null;
  }

  const pane = <ExplorePane sessionId={SESSION_ID} />;

  return (
    <ShellFrame
      session={SESSION}
      main={
        widthPx === null ? (
          pane
        ) : (
          <div style={{ width: widthPx }} className="flex h-full min-w-0 flex-col">
            {pane}
          </div>
        )
      }
    />
  );
};
