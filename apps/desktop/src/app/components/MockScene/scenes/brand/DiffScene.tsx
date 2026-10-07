import { useEffect, useState } from 'react';
import { parseUnifiedDiff } from '@goodboy/core';
import type { DiffComment } from '@goodboy/types';
import { fileSignature, writeReviewedMap } from '../../../../../features/diff/lib/reviewedFiles';
import { useAppStore } from '../../../../../store';
import { ShellFrame } from '../shellChrome';
import { BRAND_PEOPLE } from './canon';
import { CTX_SESSION, CTX_SESSION_ID, minutesAgo, seedContextBase } from './contextBase';
import {
  APPLY_WEBHOOK_NOTE_LINE,
  APPLY_WEBHOOK_PATH,
  CTX_PATCH,
  POST_CREDIT_PATH,
  RENAMED_PATH,
} from './contextDiffPatch';
import { CLEAN_HANDLERS, EDITS_ONLY_HANDLERS } from './diffEmptyHandlers';
import { DiffStage, handlersFor } from './DiffStage';
import { LARGE_PATCH } from './largeDiffPatch';
import { MANY_FILES_PATCH } from './manyFilesDiffPatch';

const MANY_FILES_HANDLERS = handlersFor(MANY_FILES_PATCH);
const LARGE_HANDLERS = handlersFor(LARGE_PATCH);

const NOTES: ReadonlyArray<DiffComment> = [
  {
    id: 'mock-brand-diff-note-duplicate-log',
    sessionId: CTX_SESSION_ID,
    filePath: APPLY_WEBHOOK_PATH,
    body: `Log the duplicate at info with the event id, so on-call can count redeliveries. ${BRAND_PEOPLE.reviewer.name} asked for it on #318.`,
    status: 'open',
    createdAt: minutesAgo(9),
    anchor: { side: 'new', lineNumber: APPLY_WEBHOOK_NOTE_LINE },
    authorKind: 'user',
  },
  {
    id: 'mock-brand-diff-note-rename',
    sessionId: CTX_SESSION_ID,
    filePath: RENAMED_PATH,
    body: 'Keep the retries at three: the processor rate limits above that.',
    status: 'open',
    createdAt: minutesAgo(14),
    authorKind: 'user',
  },
];

const markViewed = (): void => {
  const file = parseUnifiedDiff(CTX_PATCH).find((entry) => entry.path === POST_CREDIT_PATH);
  if (file === undefined) {
    return;
  }
  writeReviewedMap(CTX_SESSION_ID, { kind: 'branch' }, { [file.path]: fileSignature(file) });
};

type Props = {
  readonly manyFiles?: boolean;
  readonly largeChange?: boolean;
  readonly empty?: 'clean' | 'editsOnly';
};

export const BrandDiffScene = ({
  manyFiles = false,
  largeChange = false,
  empty = undefined,
}: Props) => {
  const [isReady, setIsReady] = useState(false);
  const [isStaged, setIsStaged] = useState(false);

  useEffect(() => {
    seedContextBase({ lens: 'branch' });
    markViewed();
    useAppStore.setState({
      diffComments: { [CTX_SESSION_ID]: NOTES },
      diffFocus:
        empty === 'clean' ? { [CTX_SESSION_ID]: { kind: 'working' as const, path: null } } : {},
      branchTab: { [CTX_SESSION_ID]: 'files' },
      branchThreadId: {},
      loadDiffComments: async () => undefined,
      sessionPhaseRuns: { [CTX_SESSION_ID]: [] },
    });
    setIsReady(true);
  }, [empty]);

  useEffect(() => {
    if (isReady) {
      setIsStaged(true);
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  const stage =
    empty !== undefined ? (
      <DiffStage
        handlers={empty === 'clean' ? CLEAN_HANDLERS : EDITS_ONLY_HANDLERS}
        centerNote={false}
      />
    ) : largeChange ? (
      <DiffStage handlers={LARGE_HANDLERS} centerNote={false} />
    ) : manyFiles ? (
      <DiffStage handlers={MANY_FILES_HANDLERS} centerNote={false} />
    ) : (
      <DiffStage />
    );

  return <ShellFrame session={CTX_SESSION} main={isStaged ? stage : null} />;
};
