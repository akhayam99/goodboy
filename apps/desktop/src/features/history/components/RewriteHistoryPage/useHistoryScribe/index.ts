import { useState } from 'react';
import type { BranchCommit, MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { scribeKeyOf } from '../../../../../store/slices/scribe/scribeKeyOf';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly editingSha: string | null;
};

export const useHistoryScribe = ({ sessionId, mountId, editingSha }: Params) => {
  const scribe = useAppStore((s) =>
    mountId === null
      ? null
      : (s.scribeWork[scribeKeyOf({ mountId, kind: 'commit-message' })] ?? null),
  );
  const requestScribe = useAppStore((s) => s.requestScribe);
  const [scribeFor, setScribeFor] = useState<string | null>(null);
  const suggest = ({ commit }: { readonly commit: BranchCommit }) => {
    if (mountId === null) {
      return;
    }
    setScribeFor(commit.sha);
    void requestScribe({
      sessionId,
      mountId,
      task: {
        kind: 'commit-message',
        verb: 'reword',
        commits: [{ sha: commit.sha, subject: commit.subject }],
      },
    }).catch(() => undefined);
  };
  const suggestion =
    scribe?.status === 'ready' && scribeFor !== null && scribeFor === editingSha
      ? (scribe.output?.commitMessages[0]?.message ?? null)
      : null;
  const isSuggestingFor = (sha: string): boolean =>
    scribe?.status === 'writing' && scribeFor === sha;
  return { suggest, suggestion, isSuggestingFor };
};
