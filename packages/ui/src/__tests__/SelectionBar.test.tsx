// @vitest-environment happy-dom

import { useState } from 'react';
import { Archive, Trash2 } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SelectionBar, type SelectionVerb } from '../components/SelectionBar';
import { SelectionConfirm } from '../components/SelectionBar/SelectionConfirm';
import { SelectionCheckbox } from '../components/SelectionCheckbox';

afterEach(cleanup);

const verbs = ({ run }: { readonly run: (id: string) => void }): ReadonlyArray<SelectionVerb> => [
  {
    id: 'archive',
    label: 'Archive',
    ariaLabel: 'Archive 3 sessions',
    icon: <Archive size={14} aria-hidden />,
    onRun: () => run('archive'),
  },
  {
    id: 'delete',
    label: 'Delete',
    ariaLabel: 'Delete 3 sessions',
    tone: 'danger',
    icon: <Trash2 size={14} aria-hidden />,
    onRun: () => run('delete'),
  },
];

const press = (key: string): void => {
  fireEvent.keyDown(window, { key, code: key });
};

describe('SelectionBar', () => {
  it('says how many are selected and offers every row when some are left', () => {
    const onSelectAll = vi.fn();
    render(
      <SelectionBar
        count={3}
        total={11}
        verbs={verbs({ run: vi.fn() })}
        onClear={vi.fn()}
        onSelectAll={onSelectAll}
      />,
    );

    const toolbar = screen.getByRole('toolbar', { name: '3 selected' });
    expect(toolbar.textContent).toContain('3 selected');
    fireEvent.click(screen.getByRole('button', { name: 'Select all 11' }));
    expect(onSelectAll).toHaveBeenCalledTimes(1);
  });

  it('reports the height of the dock while it shows and zero once it goes', () => {
    const observers: Array<(entries: ReadonlyArray<{ contentRect: { height: number } }>) => void> =
      [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(
          callback: (entries: ReadonlyArray<{ contentRect: { height: number } }>) => void,
        ) {
          observers.push(callback);
        }
        observe = (): void => undefined;
        disconnect = (): void => undefined;
      },
    );
    const onHeightChange = vi.fn();
    const { rerender } = render(
      <SelectionBar
        count={3}
        total={11}
        verbs={[]}
        onClear={vi.fn()}
        onSelectAll={vi.fn()}
        onHeightChange={onHeightChange}
      />,
    );

    observers[0]?.([{ contentRect: { height: 132 } }]);
    expect(onHeightChange).toHaveBeenLastCalledWith(132);
    rerender(
      <SelectionBar
        count={0}
        total={11}
        verbs={[]}
        onClear={vi.fn()}
        onSelectAll={vi.fn()}
        onHeightChange={onHeightChange}
      />,
    );
    expect(onHeightChange).toHaveBeenLastCalledWith(0);
    vi.unstubAllGlobals();
  });

  it('drops Select all once every row is selected', () => {
    render(
      <SelectionBar
        count={11}
        total={11}
        verbs={verbs({ run: vi.fn() })}
        onClear={vi.fn()}
        onSelectAll={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /Select all/ })).toBeNull();
  });

  it('renders nothing when nothing is selected and nothing is pending', () => {
    const { container } = render(
      <SelectionBar
        count={0}
        total={11}
        verbs={verbs({ run: vi.fn() })}
        onClear={vi.fn()}
        onSelectAll={vi.fn()}
      />,
    );

    expect(container.textContent).toBe('');
  });

  it('runs the verb the user pressed, under its full accessible name', () => {
    const run = vi.fn();
    render(
      <SelectionBar
        count={3}
        total={11}
        verbs={verbs({ run })}
        onClear={vi.fn()}
        onSelectAll={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Archive 3 sessions' }));
    expect(run).toHaveBeenCalledWith('archive');
    expect(screen.getByRole('button', { name: 'Delete 3 sessions' }).textContent).toBe('Delete');
  });

  it('clears on the X button and on Escape', () => {
    const onClear = vi.fn();
    render(
      <SelectionBar
        count={2}
        total={5}
        verbs={verbs({ run: vi.fn() })}
        onClear={onClear}
        onSelectAll={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    press('Escape');
    expect(onClear).toHaveBeenCalledTimes(2);
  });

  it('closes the confirmation first on Escape and keeps the selection', () => {
    const onClear = vi.fn();
    const onDismissConfirm = vi.fn();
    render(
      <SelectionBar
        count={2}
        total={5}
        verbs={verbs({ run: vi.fn() })}
        onClear={onClear}
        onSelectAll={vi.fn()}
        onDismissConfirm={onDismissConfirm}
        confirm={<p>Delete 2 sessions?</p>}
      />,
    );

    press('Escape');
    expect(onDismissConfirm).toHaveBeenCalledTimes(1);
    expect(onClear).not.toHaveBeenCalled();
  });

  it('puts the confirmation above the bar, focused on Cancel', () => {
    render(
      <SelectionBar
        count={3}
        total={11}
        verbs={verbs({ run: vi.fn() })}
        onClear={vi.fn()}
        onSelectAll={vi.fn()}
        confirm={
          <SelectionConfirm
            role="danger"
            icon={<Trash2 size={14} aria-hidden />}
            title="Delete 3 sessions?"
            goes="Agents and chat history on this machine."
            stays="Pull requests on GitHub."
            items={['One', 'Two', 'Three', 'Four', 'Five']}
            confirmLabel="Delete 3 sessions"
            onConfirm={vi.fn()}
            onCancel={vi.fn()}
          />
        }
      />,
    );

    const confirm = screen.getByRole('group', { name: 'Delete 3 sessions?' });
    const toolbar = screen.getByRole('toolbar', { name: '3 selected' });
    expect(confirm.compareDocumentPosition(toolbar) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    expect(confirm.textContent).toContain('Goes');
    expect(confirm.textContent).toContain('Stays');
    expect(confirm.textContent).toContain('and 2 more');
  });

  it('returns focus to the verb that opened the confirmation once it closes', () => {
    const Harness = () => {
      const [isOpen, setIsOpen] = useState(false);
      return (
        <SelectionBar
          count={3}
          total={11}
          verbs={[
            {
              id: 'delete',
              label: 'Delete',
              icon: <Trash2 size={14} aria-hidden />,
              onRun: () => setIsOpen(true),
            },
          ]}
          onClear={vi.fn()}
          onSelectAll={vi.fn()}
          onDismissConfirm={() => setIsOpen(false)}
          confirm={
            isOpen ? (
              <SelectionConfirm
                role="danger"
                icon={<Trash2 size={14} aria-hidden />}
                title="Delete 3 sessions?"
                confirmLabel="Delete 3 sessions"
                onConfirm={vi.fn()}
                onCancel={() => setIsOpen(false)}
              />
            ) : null
          }
        />
      );
    };
    render(<Harness />);

    const verb = screen.getByRole('button', { name: 'Delete' });
    verb.focus();
    fireEvent.click(verb);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete' }));
  });

  it('hands focus back to the surface when the bar goes away under it', () => {
    const onFocusReturn = vi.fn();
    const Harness = ({ count }: { readonly count: number }) => (
      <SelectionBar
        count={count}
        total={11}
        verbs={verbs({ run: vi.fn() })}
        onClear={vi.fn()}
        onSelectAll={vi.fn()}
        onFocusReturn={onFocusReturn}
      />
    );
    const { rerender } = render(<Harness count={2} />);
    screen.getByRole('button', { name: 'Archive 3 sessions' }).focus();

    rerender(<Harness count={0} />);

    expect(onFocusReturn).toHaveBeenCalledTimes(1);
  });

  it('keeps showing a note after the selection is gone', () => {
    render(
      <SelectionBar
        count={0}
        total={11}
        verbs={[]}
        onClear={vi.fn()}
        onSelectAll={vi.fn()}
        note={<p role="status">Archived 3 sessions</p>}
      />,
    );

    expect(screen.getByRole('status').textContent).toBe('Archived 3 sessions');
    expect(screen.queryByRole('toolbar')).toBeNull();
  });
});

describe('SelectionCheckbox', () => {
  it('reads its state from aria-checked and toggles without bubbling to the row', () => {
    const onToggle = vi.fn();
    const onRowClick = vi.fn();
    const { rerender } = render(
      <div onClick={onRowClick}>
        <SelectionCheckbox
          checked={false}
          label="Select Rate-limit the payout API"
          onToggle={onToggle}
        />
      </div>,
    );

    const box = screen.getByRole('checkbox', { name: 'Select Rate-limit the payout API' });
    expect(box.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(box);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();

    rerender(
      <div onClick={onRowClick}>
        <SelectionCheckbox checked label="Select Rate-limit the payout API" onToggle={onToggle} />
      </div>,
    );
    expect(
      screen
        .getByRole('checkbox', { name: 'Select Rate-limit the payout API' })
        .getAttribute('aria-checked'),
    ).toBe('true');
  });
});
