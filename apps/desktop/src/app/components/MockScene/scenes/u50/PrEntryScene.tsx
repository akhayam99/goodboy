import { useEffect, useState } from 'react';
import { AppShell } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { BranchChecks } from '../../../../../features/branch/components/BranchChecks';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { ScenePlacesRail } from '../ScenePlacesRail';
import { CentralColumnScene } from '../u26/CentralColumnScene';
import { checksAnalyzeSeed } from '../u24/checksAnalyzeSeed';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly view: 'checks' | 'blocks';
};

const LOG_LINES: ReadonlyArray<string> = [
  'FAIL src/ledger.test.ts > applies one credit per invoice',
  'AssertionError: expected 2 to be 1',
  '  Expected credits: 1',
  '  Received credits: 2',
  '    at src/ledger.test.ts:41:23',
  'Retry applies the same credit twice.',
];

export const PrEntryScene = ({ theme, view }: Props) => {
  const [sessionId, setSessionId] = useState<SessionId | null>(null);
  useEffect(() => {
    if (view !== 'checks') {
      useAppStore.setState({ sessionOpenQuestions: {} });
      return;
    }
    applyDocumentTheme({ theme });
    const seeded = checksAnalyzeSeed({ phase: 'failing' });
    const detailsUrl = seeded.check.detailsUrl ?? '';
    useAppStore.setState((state) => ({
      checkLogs: {
        ...state.checkLogs,
        [detailsUrl]: {
          detailsUrl,
          status: 'ready',
          fetchedAt: '2026-10-10T09:40:00.000Z',
          testFile: 'src/ledger.test.ts',
          testName: 'applies one credit per invoice',
          isTimeout: false,
          lines: LOG_LINES,
        },
      },
    }));
    setSessionId(seeded.sessionId);
  }, [theme, view]);
  if (view === 'blocks') {
    return <CentralColumnScene theme={theme} kind="branches" />;
  }
  if (sessionId === null) {
    return null;
  }
  return (
    <div className="[&>div]:w-full" style={{ width: 1360 }}>
      <AppShell
        leftRail={<ScenePlacesRail />}
        main={
          <div className="flex h-full min-w-0 flex-col gap-4 py-4">
            <BranchChecks sessionId={sessionId} />
          </div>
        }
      />
    </div>
  );
};
