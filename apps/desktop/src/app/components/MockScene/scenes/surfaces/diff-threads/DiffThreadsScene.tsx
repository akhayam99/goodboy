import { useEffect, useState } from 'react';
import { useAppStore } from '../../../../../../store';
import { ShellFrame } from '../../shellChrome';
import { NOTE_IDS, resolveNotesFor, type NotePlace } from '../../resolveNotesSeed';
import {
  CTX_PAYMENTS_MOUNT_ID,
  CTX_SESSION,
  CTX_SESSION_ID,
  seedContextBase,
} from '../../brand/contextBase';
import { APPLY_WEBHOOK_PATH, POST_CREDIT_PATH } from '../../brand/contextDiffPatch';
import { DiffStage } from '../../brand/DiffStage';
import { hostThreadsGithub } from './hostThreadsSeed';

const PLACES: Readonly<Record<keyof typeof NOTE_IDS, NotePlace>> = {
  open: { filePath: APPLY_WEBHOOK_PATH, line: 13 },
  openSecond: { filePath: POST_CREDIT_PATH, line: 20 },
  working: { filePath: APPLY_WEBHOOK_PATH, line: 18 },
  needs: { filePath: POST_CREDIT_PATH, line: 11 },
  ready: { filePath: APPLY_WEBHOOK_PATH, line: 22 },
  failed: { filePath: POST_CREDIT_PATH, line: 7 },
  done: { filePath: APPLY_WEBHOOK_PATH, line: 2 },
};

export const DiffThreadsScene = () => {
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
      mountGithub: { [CTX_PAYMENTS_MOUNT_ID]: hostThreadsGithub() },
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

  return <ShellFrame session={CTX_SESSION} main={<DiffStage centerNote={false} />} />;
};
