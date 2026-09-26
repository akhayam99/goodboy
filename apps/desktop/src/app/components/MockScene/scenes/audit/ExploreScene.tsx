import { useEffect, useState } from 'react';
import { mockIPC } from '@tauri-apps/api/mocks';
import { ExplorePane } from '../../../../../features/explore/components/ExplorePane';
import { ShellFrame, seedShellChrome } from '../shellChrome';
import { SESSION, SESSION_ID, seedArtifactScene } from '../artifactSeed';
import { payloadString } from './ipcPayload';
import { sceneParam, sceneParamList } from './sceneParams';
import { useSceneClicks } from './useSceneClicks';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-09-14T16:40:00.000Z' });

const VARIANT = sceneParam({ key: 'v' }) ?? 'populated';
const OPEN_LABELS = sceneParamList({ key: 'open', separator: ',' });

const NOW = clock.iso({ at: '2026-09-14T16:40:00.000Z' });
const SESSION_DIR = '/mock/harborline/sessions/settlement-rounding';
const MODIFIED_AT = clock.iso({ at: '2026-09-14T15:40:00.000Z' });

type EntryParams = {
  readonly name: string;
  readonly relPath: string;
  readonly isDir: boolean;
  readonly sizeBytes: number;
};

const entry = ({ name, relPath, isDir, sizeBytes }: EntryParams) => ({
  name,
  relPath,
  isDir,
  sizeBytes,
  modifiedAt: MODIFIED_AT,
});

const ROOT = [
  entry({ name: 'notes', relPath: 'notes', isDir: true, sizeBytes: 0 }),
  entry({ name: 'exports', relPath: 'exports', isDir: true, sizeBytes: 0 }),
  entry({ name: 'brief.md', relPath: 'brief.md', isDir: false, sizeBytes: 2140 }),
  entry({
    name: 'settlement-batches.csv',
    relPath: 'settlement-batches.csv',
    isDir: false,
    sizeBytes: 482113,
  }),
  entry({
    name: 'drift-summary.xlsx',
    relPath: 'drift-summary.xlsx',
    isDir: false,
    sizeBytes: 90211,
  }),
];

const NOTES = [
  entry({
    name: 'northwind-call.md',
    relPath: 'notes/northwind-call.md',
    isDir: false,
    sizeBytes: 1804,
  }),
  entry({
    name: 'open-questions.md',
    relPath: 'notes/open-questions.md',
    isDir: false,
    sizeBytes: 640,
  }),
];

const BRIEF = `# Settlement rounding brief

Northwind finance sees one cent drift on split batches.

- ledger-core rounds each posting
- the backfill must stay in dry run until totals match
`;

type ListParams = {
  readonly relPath: string;
};

const listFolder = ({ relPath }: ListParams) => {
  if (VARIANT === 'error') {
    throw new Error('Permission denied reading the session folder');
  }
  if (VARIANT === 'empty' || relPath === 'exports') {
    return [];
  }
  if (relPath === 'notes') {
    return NOTES;
  }
  return ROOT;
};

const installIpc = (): void => {
  mockIPC((cmd, payload) => {
    if (cmd === 'explore_list') {
      return listFolder({ relPath: payloadString({ payload, key: 'relPath' }) ?? '' });
    }
    if (cmd === 'explore_read') {
      return { type: 'text', text: BRIEF, truncated: false };
    }
    return null;
  });
};

export const ExploreScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    installIpc();
    seedArtifactScene({ focusedArtifactId: null });
    seedShellChrome({
      session: SESSION,
      siblings: [],
      branches: {},
      telemetryAt: NOW,
      lens: 'explore',
    });
    setIsReady(true);
  }, []);

  useSceneClicks({
    isReady,
    labels: OPEN_LABELS,
    selector: 'button, [role="treeitem"]',
    match: 'prefix',
    intervalMs: 250,
  });

  if (!isReady) {
    return null;
  }

  return (
    <ShellFrame
      session={SESSION}
      main={<ExplorePane sessionId={SESSION_ID} sessionDir={SESSION_DIR} />}
    />
  );
};
