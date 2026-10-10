import { useEffect, useState } from 'react';
import { parseUnifiedDiff } from '@goodboy/core';
import { UnderTrailContext } from '@goodboy/ui';
import type { DiffComment } from '@goodboy/types';
import { fileSignature, writeReviewedMap } from '../../../../../features/diff/lib/reviewedFiles';
import { AskTrailButton } from '../../../../../features/session/ask/components/AskTrailButton';
import { TrailBar } from '../../../../../features/session/components/SessionWorkspace/parts/TrailBar';
import { useAppStore } from '../../../../../store';
import { BRAND_PEOPLE } from '../brand/canon';
import {
  CTX_PAYMENTS_MOUNT_ID,
  CTX_SESSION,
  CTX_SESSION_ID,
  minutesAgo,
  seedContextBase,
} from '../brand/contextBase';
import { DiffStage, handlersFor } from '../brand/DiffStage';

const DOCKED_PANE_PX = 1920 - 244;
const ROOT = 'apps/web/src/domains/ledger';
const VIEWED_EVERY = 3;
const VIEWED_COUNT = 12;

const FOLDERS: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
  ['', ['types.ts', 'index.ts', 'constants.ts']],
  ['entries', ['entry.ts', 'entryList.ts']],
  ['entries/import', ['importEntries.ts', 'validateRow.ts']],
  ['entries/import/parsers', ['csvParser.ts', 'ofxParser.ts', 'camtParser.ts']],
  ['reconciliation', ['reconcile.ts', 'matchRules.ts']],
  ['reconciliation/rules', ['amountRule.ts', 'dateRule.ts', 'referenceRule.ts']],
  ['reconciliation/rules/rounding', ['roundHalfEven.ts', 'roundingPolicy.ts', 'minorUnits.ts']],
  ['reports', ['reportBuilder.ts']],
  ['reports/export', ['exportReport.ts', 'exportQueue.ts']],
  ['reports/export/csv', ['csvWriter.ts', 'csvColumns.ts', 'csvEscape.ts']],
  ['reports/summary', ['summaryTotals.ts', 'summaryPeriod.ts', 'summaryChart.ts']],
  ['settlement', ['settle.ts', 'settlementBatch.ts']],
  ['settlement/webhooks', ['applyWebhook.ts', 'seenEvents.ts', 'signature.ts']],
  ['settlement/webhooks/retry', ['backoff.ts', 'retryQueue.ts']],
  ['components', ['LedgerTable.tsx', 'LedgerRow.tsx']],
  ['components/filters', ['DateFilter.tsx', 'AmountFilter.tsx']],
  ['components/filters/presets', ['presets.ts']],
];

const PATHS: ReadonlyArray<string> = FOLDERS.flatMap(([folder, names]) =>
  names.map((name) => (folder === '' ? `${ROOT}/${name}` : `${ROOT}/${folder}/${name}`)),
);

const identOf = (path: string): string =>
  (path.split('/').at(-1) ?? 'value').replace(/\.[a-z]+$/, '');

const patchOf = (path: string): string =>
  [
    `diff --git a/${path} b/${path}`,
    'index 1111111..2222222 100644',
    `--- a/${path}`,
    `+++ b/${path}`,
    '@@ -1,3 +1,3 @@',
    " import { ledger } from '@harborline/ledger-core';",
    `-export const ${identOf(path)} = 1;`,
    `+export const ${identOf(path)} = 2;`,
    ' export {};',
    '',
  ].join('\n');

const PATCH = PATHS.map(patchOf).join('');

const NOTE_PATHS: ReadonlyArray<string> = [
  `${ROOT}/reconciliation/rules/rounding/roundHalfEven.ts`,
  `${ROOT}/settlement/webhooks/applyWebhook.ts`,
];

const NOTES: ReadonlyArray<DiffComment> = NOTE_PATHS.map((filePath, index) => ({
  id: `mock-u24-diff-folds-note-${index}`,
  sessionId: CTX_SESSION_ID,
  filePath,
  body:
    index === 0
      ? `Round half to even here, not half up. ${BRAND_PEOPLE.reviewer.name} asked for it on #318.`
      : 'Log the duplicate at info with the event id.',
  status: 'open',
  createdAt: minutesAgo(9 + index),
  anchor: { side: 'new', lineNumber: 2 },
  authorKind: 'user',
}));

const markViewed = (): void => {
  const viewed = Object.fromEntries(
    parseUnifiedDiff(PATCH)
      .filter((_, index) => index % VIEWED_EVERY === 0)
      .slice(0, VIEWED_COUNT)
      .map((file) => [file.path, fileSignature(file)]),
  );
  writeReviewedMap(CTX_SESSION_ID, { kind: 'branch' }, viewed, CTX_PAYMENTS_MOUNT_ID);
};

const HANDLERS = handlersFor(PATCH);

const DeepFilesScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedContextBase({ lens: 'branch' });
    markViewed();
    useAppStore.setState({
      diffComments: { [CTX_SESSION_ID]: [...NOTES] },
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
      style={{ width: DOCKED_PANE_PX }}
    >
      <TrailBar session={CTX_SESSION} end={<AskTrailButton sessionId={CTX_SESSION_ID} />} />
      <UnderTrailContext.Provider value>
        <div className="relative min-h-0 flex-1">
          <div className="absolute inset-0 z-0">
            <DiffStage handlers={HANDLERS} centerNote={false} />
          </div>
        </div>
      </UnderTrailContext.Provider>
    </main>
  );
};

export const U24_P_DIFF_FOLDS_SCENES = {
  'branch-files-deep': () => <DeepFilesScene />,
};
