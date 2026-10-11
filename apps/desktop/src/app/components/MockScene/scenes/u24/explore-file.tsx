import { useEffect, useState } from 'react';
import { mockIPC } from '@tauri-apps/api/mocks';
import { ExplorePane } from '../../../../../features/explore/components/ExplorePane';
import { useAppStore } from '../../../../../store';
import { DrawerHost } from '../../../DrawerHost';
import { sceneClock } from '../../sceneClock';
import { SESSION_ID, seedArtifactScene } from '../artifactSeed';
import { payloadString } from '../audit/ipcPayload';

const clock = sceneClock({ anchor: '2026-10-06T09:40:00.000Z' });

const SESSION_DIR = '~/code/harborline/sessions/settlement-rounding';
const MODIFIED_AT = clock.iso({ at: '2026-10-05T19:40:00.000Z' });
const DRAWER_WIDTH_PX = 720;
const OVERLAY_STAGE_PX = 1100;
const OVERLAY_DRAWER_PX = 1000;
const STAGE_HEIGHT_PX = 560;

const ROUNDING_SOURCE = `import { type Posting } from './posting';

type RoundParams = {
  readonly posting: Posting;
};

type TotalParams = {
  readonly postings: ReadonlyArray<Posting>;
};

const CENTS = 100;

export const roundPosting = ({ posting }: RoundParams): number => {
  if (posting.amount < 0) {
    return -roundPosting({ posting: { ...posting, amount: -posting.amount } });
  }
  return Math.round(posting.amount * CENTS) / CENTS;
};

export const totalOf = ({ postings }: TotalParams): number =>
  postings.reduce((sum, posting) => sum + roundPosting({ posting }), 0);
`;

const BRIEF = `# Settlement rounding brief

Northwind finance sees one cent drift on split batches.

- ledger-core rounds each posting
- the backfill must stay in dry run until totals match
`;

type EntryParams = {
  readonly name: string;
  readonly relPath: string;
  readonly sizeBytes: number;
};

const entry = ({ name, relPath, sizeBytes }: EntryParams) => ({
  name,
  relPath,
  isDir: false,
  sizeBytes,
  modifiedAt: MODIFIED_AT,
});

const ROUNDING_ENTRY = entry({
  name: 'rounding.ts',
  relPath: 'apps/ledger-core/src/settlement/rounding.ts',
  sizeBytes: 842,
});
const BRIEF_ENTRY = entry({ name: 'brief.md', relPath: 'brief.md', sizeBytes: 2140 });
const BLOB_ENTRY = entry({
  name: 'drift-snapshot.dat',
  relPath: 'exports/drift-snapshot.dat',
  sizeBytes: 482113,
});

type Variant = 'ts' | 'md' | 'binary';

const ENTRIES = { ts: ROUNDING_ENTRY, md: BRIEF_ENTRY, binary: BLOB_ENTRY } as const;

const CONTENTS = {
  ts: { type: 'text', text: ROUNDING_SOURCE, truncated: false },
  md: { type: 'text', text: BRIEF, truncated: false },
  binary: { type: 'binary', size: 482113 },
} as const;

type PrepareParams = {
  readonly variant: Variant;
};

const prepare = ({ variant }: PrepareParams): void => {
  mockIPC((command, payload) => {
    if (command === 'explore_list') {
      return payloadString({ payload, key: 'relPath' }) === null
        ? [ROUNDING_ENTRY, BRIEF_ENTRY]
        : [];
    }
    if (command === 'explore_read') {
      return CONTENTS[variant];
    }
    return null;
  });
  seedArtifactScene({ focusedArtifactId: null });
  useAppStore.getState().openDrawer({
    kind: 'explore-file',
    sessionId: SESSION_ID,
    payload: { sessionDir: SESSION_DIR, entry: ENTRIES[variant] },
  });
};

type StageProps = {
  readonly variant: Variant;
  readonly isOverlay?: boolean;
};

const FileStage = ({ variant, isOverlay = false }: StageProps) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    prepare({ variant });
    setIsReady(true);
  }, [variant]);

  if (!isReady) {
    return null;
  }

  if (isOverlay) {
    return (
      <div
        data-testid="explore-file-stage"
        className="relative overflow-hidden rounded-lg bg-background"
        style={{ width: OVERLAY_STAGE_PX, height: STAGE_HEIGHT_PX }}
      >
        <div className="h-full w-full">
          <ExplorePane sessionId={SESSION_ID} />
        </div>
        <div className="absolute inset-0 bg-scrim" aria-hidden />
        <div
          className="absolute inset-y-0 right-0 overflow-hidden rounded-l-lg bg-subtle shadow-lg"
          style={{ width: OVERLAY_DRAWER_PX }}
        >
          <DrawerHost />
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="explore-file-stage"
      className="overflow-hidden rounded-lg bg-subtle ring-1 ring-border-soft"
      style={{ width: DRAWER_WIDTH_PX, height: STAGE_HEIGHT_PX }}
    >
      <DrawerHost />
    </div>
  );
};

export const U24_EXPLORE_FILE_SCENES = {
  'explorefile-ts': () => <FileStage variant="ts" />,
  'explorefile-md': () => <FileStage variant="md" />,
  'explorefile-binary': () => <FileStage variant="binary" />,
  'explorefile-overlay': () => <FileStage variant="ts" isOverlay />,
};
