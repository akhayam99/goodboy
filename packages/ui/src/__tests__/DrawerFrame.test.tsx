// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { DrawerFrame } from '../components/DrawerFrame';

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
      <DrawerFrame title="Drafts" closeLabel="Close drafts" onClose={onClose}>
        <p>payout.ts:13</p>
      </DrawerFrame>,
    );

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Close drafts' }));

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
});
