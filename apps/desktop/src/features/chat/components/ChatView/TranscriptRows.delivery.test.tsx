// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type SessionId,
} from '@goodboy/types';
import type { TranscriptItem } from '../../utils/transcript-items';
import type { TranscriptRow } from '../../utils/cluster-operations';
import { aPlannerQuestion } from '../../../../test/planDrawerFixtures';

vi.mock('../TranscriptCards', () => ({
  TranscriptCard: ({ item }: { item: TranscriptItem }) => <div data-testid="card">{item.kind}</div>,
}));
vi.mock('../OperationsCluster', () => ({ OperationsCluster: () => <div data-testid="ops" /> }));
vi.mock('../ThinkingIndicator', () => ({
  ThinkingIndicator: () => <div data-testid="thinking" />,
}));
vi.mock('./OpenQuestionCluster', () => ({ OpenQuestionCluster: () => <div data-testid="oq" /> }));

import { TranscriptRows } from './TranscriptRows';

afterEach(cleanup);

const AT = brandId<IsoDateTime>({ value: new Date().toISOString() });

const itemRow = (item: TranscriptItem): TranscriptRow => ({ kind: 'item', key: item.key, item });

const renderRows = ({ rows }: { readonly rows: ReadonlyArray<TranscriptRow> }) =>
  render(
    <ul>
      <TranscriptRows
        rows={rows}
        oqByTurnOrdinal={new Map([[1, [aPlannerQuestion()]]])}
        sessionId={brandId<SessionId>({ value: 's1' })}
        selectedAgentId={brandId<AgentId>({ value: 'a1' })}
        workingDir={null}
        onRefreshAuth={() => undefined}
        onOpenDiff={() => undefined}
        isThinking={false}
        thinkingContext="think"
        onRetryRun={() => undefined}
        retryingRunId={null}
      />
    </ul>,
  );

const kindsOf = ({ container }: { readonly container: HTMLElement }) =>
  [...container.querySelectorAll('li')].map(
    (li) => li.querySelector('[data-testid]')?.getAttribute('data-testid') ?? '',
  );

describe('TranscriptRows with delivered text', () => {
  it('counts a delivery as a turn and the operator echo as none, so a question stays in place', () => {
    const { container } = renderRows({
      rows: [
        itemRow({
          kind: 'auto_delivery',
          key: 'd1',
          runId: brandId<ProviderRunId>({ value: 'run-auto-1' }),
          text: 'delivery',
          at: AT,
        }),
        itemRow({
          kind: 'user_text',
          key: 'echo',
          text: 'Also cover refunds.',
          isOperatorEcho: true,
          at: AT,
        }),
        itemRow({ kind: 'assistant_text', key: 'a1', text: 'On it.' }),
      ],
    });

    expect(kindsOf({ container })).toEqual(['card', 'card', 'card', 'oq']);
  });

  it('counts a typed message as a turn', () => {
    const { container } = renderRows({
      rows: [
        itemRow({ kind: 'user_text', key: 'u1', text: 'Trace it.', at: AT }),
        itemRow({ kind: 'assistant_text', key: 'a1', text: 'On it.' }),
      ],
    });

    expect(kindsOf({ container })).toEqual(['card', 'card', 'oq']);
  });
});
