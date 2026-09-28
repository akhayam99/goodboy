import { useEffect, useState } from 'react';
import { useAppStore } from '../../../../../store';
import type { HistoryDraft, HistoryRun } from '../../../../../store/slices/history/types';
import type { MountGithubState } from '../../../../../store/types';
import { ShellFrame } from '../shellChrome';
import { CTX_PAYMENTS_MOUNT_ID, CTX_SESSION, CTX_SESSION_ID, seedContextBase } from './contextBase';
import { HistoryStage } from './HistoryStage';
import { LEDGER_MOUNTS } from './historySceneSeed';

type Props = {
  readonly draft: HistoryDraft;
  readonly run: HistoryRun | null;
  readonly github: MountGithubState | null;
  readonly isLedger: boolean;
};

export const HistorySceneShell = ({ draft, run, github, isLedger }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedContextBase({ lens: 'files' });
    useAppStore.setState({
      ...(isLedger ? { sessionProjectMounts: { [CTX_SESSION_ID]: [...LEDGER_MOUNTS] } } : {}),
      diffFocus: {},
      diffPage: { [CTX_SESSION_ID]: 'history' },
      historyDrafts: { [CTX_PAYMENTS_MOUNT_ID]: draft },
      historyRuns: run === null ? {} : { [CTX_PAYMENTS_MOUNT_ID]: run },
      mountGithub: github === null ? {} : { [CTX_PAYMENTS_MOUNT_ID]: github },
      loadHistoryDraft: async () => undefined,
    });
    setIsReady(true);
  }, [draft, github, isLedger, run]);

  if (!isReady) {
    return null;
  }

  return <ShellFrame session={CTX_SESSION} main={<HistoryStage />} />;
};
