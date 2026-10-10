// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ConfirmPopover } from '../components/ConfirmPopover';
import { registerEscapeLayer } from '../escape';

afterEach(cleanup);

type HarnessProps = {
  readonly onConfirm: () => void | Promise<void>;
};

const Harness = ({ onConfirm }: HarnessProps) => (
  <div>
    <ConfirmPopover
      role="danger"
      icon={null}
      title="Delete workflow run?"
      confirmLabel="Delete"
      onConfirm={onConfirm}
      trigger={({ isArmed, arm }) => (
        <button type="button" aria-expanded={isArmed} onClick={arm}>
          Delete run
        </button>
      )}
    />
    <button type="button">Outside</button>
  </div>
);

const Controlled = ({ onConfirm }: HarnessProps) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <ConfirmPopover
        role="alert"
        icon={null}
        title="Start anyway?"
        confirmLabel="Start"
        isOpen={isOpen}
        onConfirm={async () => {
          await onConfirm();
          setIsOpen(false);
        }}
        onCancel={() => setIsOpen(false)}
        trigger={() => (
          <button type="button" onClick={() => setIsOpen(true)}>
            Start
          </button>
        )}
      />
      <span>{isOpen ? 'armed' : 'idle'}</span>
    </div>
  );
};

type RowListProps = {
  readonly names: ReadonlyArray<string>;
  readonly onRemove: (name: string) => void;
};

const RowList = ({ names, onRemove }: RowListProps) => (
  <ul aria-label="Runs">
    {names.map((name) => (
      <li key={name} data-row>
        <span>{name}</span>
        <ConfirmPopover
          role="danger"
          icon={null}
          title={`Delete ${name}?`}
          confirmLabel="Delete"
          returnFocusTo={{ rowSelector: '[data-row]' }}
          onConfirm={() => onRemove(name)}
          trigger={({ arm }) => (
            <button type="button" onClick={arm}>
              {`Delete ${name}`}
            </button>
          )}
        />
        <button type="button">{`Open ${name}`}</button>
      </li>
    ))}
  </ul>
);

const RemovableRows = () => {
  const [names, setNames] = useState(['ledger-core', 'notify-relay', 'payments-api']);
  return (
    <RowList names={names} onRemove={(gone) => setNames((all) => all.filter((n) => n !== gone))} />
  );
};

const PrimaryHarness = ({ onConfirm }: HarnessProps) => (
  <ConfirmPopover
    role="primary"
    icon={null}
    title="Publish release?"
    confirmLabel="Publish"
    onConfirm={onConfirm}
    trigger={({ arm }) => (
      <button type="button" onClick={arm}>
        Publish
      </button>
    )}
  />
);

describe('ConfirmPopover', () => {
  it('arms from the trigger without acting', () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete run' }));

    expect(screen.getByRole('dialog', { name: 'Delete workflow run?' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Delete run' }).getAttribute('aria-expanded')).toBe(
      'true',
    );
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('renders the plain confirm body inside a body portal', () => {
    render(<Harness onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete run' }));

    const group = screen.getByRole('group', { name: 'Delete workflow run?' });
    expect(group.getAttribute('data-surface')).toBe('plain');
    expect(group.closest('[data-dropdown-portal]')?.parentElement).toBe(document.body);
  });

  it('cancels on Escape and on an outside click', () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete run' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Delete run' }));
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('stays open and busy while the confirm runs, then closes', async () => {
    let finish: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    render(<Harness onConfirm={() => pending} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete run' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveProperty('disabled', true);

    finish();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('moves focus to cancel on arm and back to the trigger on cancel', async () => {
    render(<Harness onConfirm={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Delete run' });

    fireEvent.click(trigger);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' })),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('follows a controlled open flag and reports Escape as a cancel', async () => {
    const onConfirm = vi.fn();
    render(<Controlled onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: 'Start anyway?' })).toBeDefined(),
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.getByText('idle')).toBeDefined());
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined());
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('takes Escape before an escape layer underneath it', () => {
    const underneath = vi.fn();
    const release = registerEscapeLayer(underneath);
    render(<Harness onConfirm={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete run' }));
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(underneath).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(underneath).toHaveBeenCalledTimes(1);
    release();
  });

  it('focuses the confirm button for a primary confirm', async () => {
    render(<PrimaryHarness onConfirm={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Publish' }),
      ),
    );
  });

  it('confirms on Cmd+Enter from the focused Cancel button', async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete run' }));
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    await waitFor(() => expect(document.activeElement).toBe(cancel));

    fireEvent.keyDown(cancel, { key: 'Enter', metaKey: true });

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('does not confirm on a plain Enter pressed on Cancel', async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete run' }));
    const cancel = screen.getByRole('button', { name: 'Cancel' });

    fireEvent.keyDown(cancel, { key: 'Enter' });

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('cycles Tab between Cancel and the confirm button', async () => {
    render(<Harness onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete run' }));
    const dialog = screen.getByRole('dialog');
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
    const confirm = within(dialog).getByRole('button', { name: 'Delete' });

    confirm.focus();
    fireEvent.keyDown(confirm, { key: 'Tab' });
    expect(document.activeElement).toBe(cancel);

    fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirm);
  });

  it('marks a trigger that ignores isArmed as expanded while open', () => {
    render(
      <ConfirmPopover
        role="danger"
        icon={null}
        title="Delete note?"
        confirmLabel="Delete"
        onConfirm={vi.fn()}
        trigger={({ arm }) => (
          <button type="button" onClick={arm}>
            Delete note
          </button>
        )}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Delete note' });
    expect(trigger.getAttribute('aria-expanded')).toBeNull();

    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(trigger.getAttribute('aria-expanded')).toBeNull();
  });

  it('ignores Escape and keeps Cancel disabled while the confirm is busy', async () => {
    let finish: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    render(<Harness onConfirm={() => pending} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete run' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveProperty('disabled', true);

    finish();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('shows the failure under the text and stays open', async () => {
    render(
      <Harness
        onConfirm={async () => {
          throw new Error('Run is locked');
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete run' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Run is locked');
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveProperty('disabled', false);
  });

  it('puts focus on the next row after the trigger unmounts', async () => {
    render(<RemovableRows />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete ledger-core' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.queryByText('ledger-core')).toBeNull());
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Delete notify-relay' }),
      ),
    );
  });

  it('falls back to the previous row when the last row goes', async () => {
    render(<RemovableRows />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete payments-api' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.queryByText('payments-api')).toBeNull());
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Delete notify-relay' }),
      ),
    );
  });

  it('falls back to the list when the only row goes', async () => {
    const Single = () => {
      const [names, setNames] = useState(['ledger-core']);
      return <RowList names={names} onRemove={() => setNames([])} />;
    };
    render(<Single />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete ledger-core' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('list')));
  });
});
