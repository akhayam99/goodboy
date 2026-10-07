import { useEffect, useState } from 'react';
import { parseUnifiedDiff } from '@goodboy/core';
import { UnderTrailContext } from '@goodboy/ui';
import type { DiffComment } from '@goodboy/types';
import { fileSignature, writeReviewedMap } from '../../../../../features/diff/lib/reviewedFiles';
import { AskTrailButton } from '../../../../../features/session/ask/components/AskTrailButton';
import { TrailBar } from '../../../../../features/session/components/SessionWorkspace/parts/TrailBar';
import { useAppStore } from '../../../../../store';
import { BRAND_PEOPLE } from '../brand/canon';
import { CTX_SESSION, CTX_SESSION_ID, minutesAgo, seedContextBase } from '../brand/contextBase';
import {
  APPLY_WEBHOOK_NOTE_LINE,
  APPLY_WEBHOOK_PATH,
  CTX_PATCH,
  POST_CREDIT_PATH,
} from '../brand/contextDiffPatch';
import { DiffStage } from '../brand/DiffStage';

const PINNED_SIDEBAR_PX = 244;
const DOCKED_PANE_PX = 1920 - PINNED_SIDEBAR_PX;
const STRIP_PANE_PX = 1440 - PINNED_SIDEBAR_PX;
const BUTTON_PANE_PX = 1100;

const NOTE: DiffComment = {
  id: 'mock-u21-files-rail-note-duplicate-log',
  sessionId: CTX_SESSION_ID,
  filePath: APPLY_WEBHOOK_PATH,
  body: `Log the duplicate at info with the event id, so on-call can count redeliveries. ${BRAND_PEOPLE.reviewer.name} asked for it on #318.`,
  status: 'open',
  createdAt: minutesAgo(9),
  anchor: { side: 'new', lineNumber: APPLY_WEBHOOK_NOTE_LINE },
  authorKind: 'user',
};

const markViewed = (): void => {
  const file = parseUnifiedDiff(CTX_PATCH).find((entry) => entry.path === POST_CREDIT_PATH);
  if (file === undefined) {
    return;
  }
  writeReviewedMap(CTX_SESSION_ID, { kind: 'branch' }, { [file.path]: fileSignature(file) });
};

type Props = {
  readonly paneWidth: number;
};

const FilesRailScene = ({ paneWidth }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedContextBase({ lens: 'branch' });
    markViewed();
    useAppStore.setState({
      diffComments: { [CTX_SESSION_ID]: [NOTE] },
      diffFocus: {},
      branchTab: { [CTX_SESSION_ID]: 'files' },
      branchThreadId: {},
      loadDiffComments: async () => undefined,
      sessionPhaseRuns: { [CTX_SESSION_ID]: [] },
    });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <main
      className="@container relative flex h-screen flex-col overflow-hidden bg-background text-foreground"
      style={{ width: paneWidth }}
    >
      <TrailBar session={CTX_SESSION} end={<AskTrailButton sessionId={CTX_SESSION_ID} />} />
      <UnderTrailContext.Provider value>
        <div className="relative min-h-0 flex-1">
          <div className="absolute inset-0 z-0">
            <DiffStage centerNote={false} />
          </div>
        </div>
      </UnderTrailContext.Provider>
    </main>
  );
};

export const U21_FILES_RAIL_SCENES = {
  'branch-files-docked': () => <FilesRailScene paneWidth={DOCKED_PANE_PX} />,
  'branch-files-strip': () => <FilesRailScene paneWidth={STRIP_PANE_PX} />,
  'branch-files-button': () => <FilesRailScene paneWidth={BUTTON_PANE_PX} />,
};
