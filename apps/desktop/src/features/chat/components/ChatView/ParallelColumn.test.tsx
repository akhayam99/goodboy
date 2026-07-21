// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ProviderRunId } from '@goodboy/types';
import type { TranscriptItem } from '../../utils/transcript-items';

const { transcriptItems, state } = vi.hoisted(() => ({
  transcriptItems: { current: [] as ReadonlyArray<TranscriptItem> },
  state: {
    sessionPhaseRuns: {},
    agentTurnState: {},
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (store: typeof state) => T) => selector(state),
  useTranscript: () => [],
}));

vi.mock('../../utils/transcript-items', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../utils/transcript-items')>();
  return {
    ...original,
    filterEventsByRunId: () => [],
    reduceTranscript: () => transcriptItems.current,
  };
});

vi.mock('../../../../shared/components/AgentAvatar', () => ({
  AgentAvatar: () => null,
}));

vi.mock('../TranscriptCards', () => ({
  TranscriptCard: ({ item }: { item: TranscriptItem }) => <div>{item.key}</div>,
}));

vi.mock('../OperationsCluster', () => ({
  OperationsCluster: ({ items }: { items: ReadonlyArray<TranscriptItem> }) => (
    <div data-testid="operations-cluster">{items.length}</div>
  ),
}));

vi.mock('@goodboy/ui', () => ({
  ScrollFade: ({ children }: { children: ReactNode }) => (
    <div className="overflow-y-auto">{children}</div>
  ),
  StatusDot: () => null,
}));

import { ParallelColumn } from './ParallelColumn';

const tool = ({ id }: { id: string }): TranscriptItem => ({
  kind: 'tool_call',
  key: `tool-${id}`,
  toolUseId: id,
  toolName: 'read',
  input: null,
  output: null,
  isError: false,
  ended: true,
});

afterEach(() => {
  cleanup();
  transcriptItems.current = [];
});

describe('ParallelColumn', () => {
  it('renders consecutive operations as one cluster', () => {
    transcriptItems.current = [tool({ id: 'a' }), tool({ id: 'b' })];

    render(
      <ParallelColumn
        runId={'run-1' as ProviderRunId}
        index={0}
        events={[]}
        workingDir={null}
        onRefreshAuth={() => undefined}
        onOpenDiff={() => undefined}
      />,
    );

    expect(screen.getAllByTestId('operations-cluster')).toHaveLength(1);
    expect(screen.getByTestId('operations-cluster').textContent).toBe('2');
  });
});
