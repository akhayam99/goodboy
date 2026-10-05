import { useEffect, useState } from 'react';
import { useAppStore } from '../../../../../store';
import { ShellFrame } from '../shellChrome';
import { NOTE_IDS, resolveNotesFor, type NotePlace } from '../resolveNotesSeed';
import { CTX_SESSION, CTX_SESSION_ID, seedContextBase } from './contextBase';
import { APPLY_WEBHOOK_NOTE_LINE, APPLY_WEBHOOK_PATH, POST_CREDIT_PATH } from './contextDiffPatch';
import { DiffStage } from './DiffStage';

const PLACES: Readonly<Record<keyof typeof NOTE_IDS, NotePlace>> = {
  open: { filePath: APPLY_WEBHOOK_PATH, line: APPLY_WEBHOOK_NOTE_LINE },
  openSecond: { filePath: POST_CREDIT_PATH, line: 20 },
  working: { filePath: APPLY_WEBHOOK_PATH, line: 13 },
  needs: { filePath: POST_CREDIT_PATH, line: 11 },
  ready: { filePath: APPLY_WEBHOOK_PATH, line: 18 },
  failed: { filePath: POST_CREDIT_PATH, line: 7 },
  done: { filePath: APPLY_WEBHOOK_PATH, line: 4 },
};

export const DiffNotesScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedContextBase({ lens: 'branch' });
    const { notes, entries, attempts } = resolveNotesFor({
      sessionId: CTX_SESSION_ID,
      places: PLACES,
      isStarted: false,
    });
    useAppStore.setState({
      diffComments: { [CTX_SESSION_ID]: notes },
      sessionResolveQueueItems: { [CTX_SESSION_ID]: entries },
      sessionResolveAttempts: { [CTX_SESSION_ID]: attempts },
      diffFocus: {},
      branchTab: { [CTX_SESSION_ID]: 'files' },
      branchThreadId: {},
      loadDiffComments: async () => undefined,
      loadResolveSession: async () => undefined,
      sessionPhaseRuns: { [CTX_SESSION_ID]: [] },
      drawer: null,
    });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return <ShellFrame session={CTX_SESSION} main={<DiffStage />} />;
};
