// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { brandId, type AgentId } from '@goodboy/types';
import { foldSpawnedRowsOf } from '../foldSpawnedRowsOf';
import type { SpawnedRow } from '../spawnedRow';
import { useSpawnedReveal } from '.';

const idOf = (value: string): AgentId => brandId<AgentId>({ value });

const rowOf = (id: string, level: number): SpawnedRow => ({
  id,
  agentId: idOf(id),
  level,
  hasChildren: false,
  title: id,
  card: { title: id, facts: [] },
  role: 'implementer',
  node: 'done',
  word: 'Done',
  isLive: false,
});

const ROWS = [rowOf('root', 1), rowOf('planner', 2), rowOf('scout', 3), rowOf('tester', 2)];

type HarnessProps = {
  readonly selectedAgentId: AgentId | null;
  readonly rows: ReadonlyArray<SpawnedRow>;
};

const Harness = ({ selectedAgentId, rows }: HarnessProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Readonly<Record<string, boolean>>>({});
  const shown = useMemo(
    () => foldSpawnedRowsOf({ rows, expanded, isOpenByDefault: false }),
    [rows, expanded],
  );
  const onExpand = useCallback((ids: ReadonlyArray<string>) => {
    setExpanded((current) => ({ ...current, ...Object.fromEntries(ids.map((id) => [id, true])) }));
  }, []);
  useSpawnedReveal({ rootRef, selectedAgentId, rows, shown, onExpand });
  return (
    <div ref={rootRef}>
      {shown.map(({ row }) => (
        <div key={row.id} data-agent-id={row.agentId} data-testid={row.id} />
      ))}
    </div>
  );
};

const scrollSpy = vi.fn();

const stubScroll = (): void => {
  scrollSpy.mockClear();
  Element.prototype.scrollIntoView = function scrollIntoView(this: Element, arg?: unknown) {
    scrollSpy(this.getAttribute('data-testid'), arg);
  };
};

afterEach(cleanup);

describe('useSpawnedReveal', () => {
  it('expands a folded parent and scrolls the selected row to the middle', () => {
    stubScroll();
    const view = render(<Harness selectedAgentId={idOf('scout')} rows={ROWS} />);

    expect(view.queryByTestId('scout')).not.toBeNull();
    expect(scrollSpy).toHaveBeenCalledWith('scout', { block: 'center' });
  });

  it('does nothing for an agent that is not in the tree', () => {
    stubScroll();
    const view = render(<Harness selectedAgentId={idOf('missing')} rows={ROWS} />);

    expect(view.queryByTestId('scout')).toBeNull();
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it('reveals again when the selection changes while open', () => {
    stubScroll();
    const view = render(<Harness selectedAgentId={idOf('root')} rows={ROWS} />);
    view.rerender(<Harness selectedAgentId={idOf('tester')} rows={ROWS} />);

    expect(scrollSpy).toHaveBeenLastCalledWith('tester', { block: 'nearest' });
    expect(scrollSpy).toHaveBeenCalledTimes(2);
  });

  it('reveals a row once its agent joins the tree', () => {
    stubScroll();
    const view = render(<Harness selectedAgentId={idOf('scout')} rows={ROWS.slice(0, 2)} />);
    expect(scrollSpy).not.toHaveBeenCalled();

    view.rerender(<Harness selectedAgentId={idOf('scout')} rows={ROWS} />);

    expect(scrollSpy).toHaveBeenCalledWith('scout', { block: 'center' });
  });
});
