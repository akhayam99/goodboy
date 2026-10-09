// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { DrawerFrame } from '../components/DrawerFrame';
import { dismissTopEscapeLayer } from '../escape';

afterEach(cleanup);

const Harness = () => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setIsOpen(true)}>
        3 drafts
      </button>
      {isOpen ? (
        <DrawerFrame title="Drafts" count={3} onClose={() => setIsOpen(false)}>
          <p>payout.ts:13</p>
        </DrawerFrame>
      ) : null}
    </div>
  );
};

describe('DrawerFrame', () => {
  it('names the panel and shows its title, count, and body', () => {
    render(
      <DrawerFrame title="Drafts" count={3} onClose={vi.fn()}>
        <p>payout.ts:13</p>
      </DrawerFrame>,
    );

    expect(screen.getByRole('region', { name: 'Drafts' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Drafts' })).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('payout.ts:13')).toBeDefined();
  });

  it('closes with Escape and with its close button', () => {
    const onClose = vi.fn();
    render(
      <DrawerFrame title="Drafts" onClose={onClose}>
        <p>payout.ts:13</p>
      </DrawerFrame>,
    );

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('hands focus back to the trigger once it closes', () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: '3 drafts' });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole('region', { name: 'Drafts' })).toBeDefined();
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(screen.queryByRole('region', { name: 'Drafts' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('names its close button Close unless a drawer asks for another label', () => {
    const view = render(
      <DrawerFrame title="Drafts" onClose={vi.fn()}>
        <p>body</p>
      </DrawerFrame>,
    );
    expect(screen.getByRole('button', { name: 'Close' })).toBeDefined();

    view.rerender(
      <DrawerFrame title="Drafts" closeLabel="Back to current" onClose={vi.fn()}>
        <p>body</p>
      </DrawerFrame>,
    );
    expect(screen.getByRole('button', { name: 'Back to current' })).toBeDefined();
  });

  it('makes the close button a 28px target', () => {
    render(
      <DrawerFrame title="Drafts" onClose={vi.fn()}>
        <p>body</p>
      </DrawerFrame>,
    );

    expect(screen.getByRole('button', { name: 'Close' }).className).toContain('size-7');
  });

  it('lets a body that scrolls itself fill the frame instead of nesting a scroller', () => {
    render(
      <DrawerFrame title="Chat" scroll="self" onClose={vi.fn()}>
        <p data-testid="chat-body">hello</p>
      </DrawerFrame>,
    );

    const body = screen.getByTestId('chat-body').parentElement;
    expect(body?.className).toContain('flex-1');
    expect(body?.className).toContain('min-h-0');
  });

  it('puts a toolbar on a second row under the title and the close button', () => {
    render(
      <DrawerFrame
        title="Retry-safe webhook credits"
        toolbar={<button type="button">Approve</button>}
        onClose={vi.fn()}
      >
        <p>body</p>
      </DrawerFrame>,
    );

    const header = screen.getByRole('banner');
    const toolbar = header.querySelector('[data-drawer-toolbar]');
    expect(toolbar?.contains(screen.getByRole('button', { name: 'Approve' }))).toBe(true);
    expect(toolbar?.contains(screen.getByRole('button', { name: 'Close' }))).toBe(false);
    expect(header.contains(screen.getByRole('button', { name: 'Close' }))).toBe(true);
    expect(
      header.contains(screen.getByRole('heading', { name: 'Retry-safe webhook credits' })),
    ).toBe(true);
  });

  it('has no toolbar row unless one is passed', () => {
    render(
      <DrawerFrame title="Drafts" onClose={vi.fn()}>
        <p>body</p>
      </DrawerFrame>,
    );

    expect(screen.getByRole('banner').querySelector('[data-drawer-toolbar]')).toBeNull();
  });

  it('focuses the close button when it opens and holds no field', () => {
    render(
      <DrawerFrame title="Drafts" onClose={vi.fn()}>
        <p>body</p>
      </DrawerFrame>,
    );

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
  });

  it('focuses the composer in its dock when it has one', () => {
    render(
      <DrawerFrame title="Chat" dock={<textarea aria-label="Reply" />} onClose={vi.fn()}>
        <p>body</p>
      </DrawerFrame>,
    );

    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Reply' }));
  });

  it('leaves focus where the body put it itself', () => {
    const Own = () => <input aria-label="Name" autoFocus />;
    render(
      <DrawerFrame title="Edit" onClose={vi.fn()}>
        <Own />
      </DrawerFrame>,
    );

    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Name' }));
  });

  it('hands focus back to the last focused control when a shortcut opened it from the page body', () => {
    const view = render(
      <div>
        <button type="button">Context</button>
      </div>,
    );
    const anchor = screen.getByRole('button', { name: 'Context' });
    anchor.focus();
    anchor.blur();
    expect(document.activeElement).toBe(document.body);

    view.rerender(
      <div>
        <button type="button">Context</button>
        <DrawerFrame title="Drafts" onClose={vi.fn()}>
          <p>body</p>
        </DrawerFrame>
      </div>,
    );
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));

    view.rerender(
      <div>
        <button type="button">Context</button>
      </div>,
    );
    expect(document.activeElement).toBe(anchor);
  });
});

type ComposerProps = { readonly onClose: () => void; readonly initial: string };

const Composer = ({ onClose, initial }: ComposerProps) => (
  <DrawerFrame
    title="Ask"
    dock={<textarea aria-label="Question" defaultValue={initial} />}
    onClose={onClose}
  >
    <p>body</p>
  </DrawerFrame>
);

describe('DrawerFrame Escape order', () => {
  it('blurs a non-empty field first and closes on the second press', () => {
    const onClose = vi.fn();
    render(<Composer onClose={onClose} initial="why is the build red" />);
    const field = screen.getByRole('textbox', { name: 'Question' });
    expect(document.activeElement).toBe(field);

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(field);
    expect((field as HTMLTextAreaElement).value).toBe('why is the build red');

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on the first press when the focused field is empty', () => {
    const onClose = vi.fn();
    render(<Composer onClose={onClose} initial="" />);

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on the first press when no field is focused', () => {
    const onClose = vi.fn();
    render(<Composer onClose={onClose} initial="draft" />);
    screen.getByRole('button', { name: 'Close' }).focus();

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('answers a scrim click the same way, through the escape stack', () => {
    const onClose = vi.fn();
    render(<Composer onClose={onClose} initial="draft" />);

    dismissTopEscapeLayer();
    expect(onClose).not.toHaveBeenCalled();

    dismissTopEscapeLayer();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores a field outside the drawer', () => {
    const onClose = vi.fn();
    render(
      <div>
        <input aria-label="Search" defaultValue="hello" />
        <DrawerFrame title="Ask" onClose={onClose}>
          <p>body</p>
        </DrawerFrame>
      </div>,
    );
    screen.getByRole('textbox', { name: 'Search' }).focus();

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
