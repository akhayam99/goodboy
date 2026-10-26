import { CircleAlert } from 'lucide-react';
import { FactCard } from '@goodboy/ui';
import type { FileDiff } from '@goodboy/types';
import { artifactStateCardOf } from '../../../../../features/artifacts/artifactStateCardOf';
import { fileCardOf } from '../../../../../features/diff/lib/fileCardOf';
import { conflictCardOf } from '../../../../../features/history/components/CommitsHistory/conflictCardOf';
import { historyMarkCardOf } from '../../../../../features/history/components/CommitsHistory/historyMarkCardOf';
import {
  checkCardOf,
  checkFootnoteOf,
} from '../../../../../features/integrations/github/components/PullRequest/checkCardOf';

const FILE: FileDiff = {
  path: 'payments-api/src/ledger/LedgerRow.tsx',
  status: 'renamed',
  oldPath: 'payments-api/src/ledger/Row.tsx',
  additions: 4,
  deletions: 1,
  binary: false,
  hunks: [],
};

const TRIGGER_CLASSES =
  'inline-flex h-7 items-center justify-center rounded-md border border-border-soft px-2 text-meta text-muted-foreground';

export const GitReviewCardsStage = () => (
  <div
    data-testid="git-review-cards-stage"
    className="grid w-264 grid-cols-3 items-start gap-x-6 gap-y-44 rounded-lg border border-border-soft bg-subtle p-6 pb-44"
  >
    <FactCard
      isOpen
      card={checkCardOf({
        check: {
          name: 'ledger-core unit tests',
          conclusion: 'failure',
          detailsUrl: 'https://ci.invalid/runs/3',
          durationMs: 154_000,
        },
        footnote: checkFootnoteOf({ detailsUrl: 'https://ci.invalid/runs/3' }),
      })}
    >
      <span className={TRIGGER_CLASSES}>ledger-core unit tests</span>
    </FactCard>
    <FactCard
      isOpen
      card={historyMarkCardOf({
        label: 'Combines 2 commits',
        facts: [
          { label: 'Commit 1', value: 'Add the Northwind export' },
          { label: 'Commit 2', value: 'Fix the export header' },
        ],
      })}
    >
      <span className={TRIGGER_CLASSES}>+2</span>
    </FactCard>
    <FactCard
      isOpen
      card={conflictCardOf({
        conflictFiles: ['payments-api/src/ledger.ts', 'payments-api/src/export.ts'],
      })}
    >
      <span className={TRIGGER_CLASSES}>may conflict in ledger.ts</span>
    </FactCard>
    <FactCard isOpen card={fileCardOf({ file: FILE })}>
      <span className={TRIGGER_CLASSES}>LedgerRow.tsx</span>
    </FactCard>
    <FactCard
      isOpen
      card={artifactStateCardOf({
        state: {
          key: 'needs',
          label: 'Needs you',
          reason: 'An agent asked a question, or the plan waits for your answer',
          tone: 'warning',
          icon: CircleAlert,
          group: 'needs',
          detail: '2 open questions',
        },
      })}
    >
      <span className={TRIGGER_CLASSES}>Needs you</span>
    </FactCard>
  </div>
);
