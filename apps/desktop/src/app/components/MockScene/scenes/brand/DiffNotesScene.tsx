import { useEffect, useState } from 'react';
import { useAppStore } from '../../../../../store';
import { noteThreadId } from '../../../../../features/resolve/notes/noteThread';
import { ShellFrame } from '../shellChrome';
import { NOTE_IDS, resolveNotesFor, type NotePlace } from '../resolveNotesSeed';
import { CTX_SESSION, CTX_SESSION_ID, seedContextBase } from './contextBase';
import { APPLY_WEBHOOK_NOTE_LINE, APPLY_WEBHOOK_PATH, POST_CREDIT_PATH } from './contextDiffPatch';
import { DiffStage } from './DiffStage';

type Stage = 'notes' | 'fix' | 'summary';

type Props = {
  readonly stage?: Stage;
};

const PLACES: Readonly<Record<keyof typeof NOTE_IDS, NotePlace>> = {
  open: { filePath: APPLY_WEBHOOK_PATH, line: APPLY_WEBHOOK_NOTE_LINE },
  openSecond: { filePath: POST_CREDIT_PATH, line: 20 },
  working: { filePath: APPLY_WEBHOOK_PATH, line: 13 },
  needs: { filePath: POST_CREDIT_PATH, line: 11 },
  ready: { filePath: APPLY_WEBHOOK_PATH, line: 18 },
  failed: { filePath: POST_CREDIT_PATH, line: 7 },
  done: { filePath: APPLY_WEBHOOK_PATH, line: 4 },
};

export const DiffNotesScene = ({ stage = 'notes' }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedContextBase({ lens: 'files' });
    const { notes, entries, attempts } = resolveNotesFor({
      sessionId: CTX_SESSION_ID,
      places: PLACES,
      isStarted: stage === 'summary',
    });
    useAppStore.setState({
      diffComments: { [CTX_SESSION_ID]: notes },
      sessionResolveQueueItems: { [CTX_SESSION_ID]: entries },
      sessionResolveAttempts: { [CTX_SESSION_ID]: attempts },
      diffFocus: {},
      diffPage: {},
      loadDiffComments: async () => undefined,
      loadResolveSession: async () => undefined,
      sessionPhaseRuns: { [CTX_SESSION_ID]: [] },
      diffNoteLaunch:
        stage === 'fix'
          ? {
              [CTX_SESSION_ID]: [NOTE_IDS.open, NOTE_IDS.openSecond].map((noteId) =>
                noteThreadId({ noteId }),
              ),
            }
          : {},
      drawer:
        stage === 'summary' ? { kind: 'diff-notes', sessionId: CTX_SESSION_ID, payload: {} } : null,
    });
    setIsReady(true);
  }, [stage]);

  if (!isReady) {
    return null;
  }

  return <ShellFrame session={CTX_SESSION} main={<DiffStage />} />;
};
