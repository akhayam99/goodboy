// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { lastFocusedElement, useLastFocused } from '../useLastFocused';

afterEach(cleanup);

type ProbeProps = { readonly onRead: (read: () => HTMLElement | null) => void };

const Probe = ({ onRead }: ProbeProps) => {
  onRead(useLastFocused());
  return <button type="button">Probe</button>;
};

describe('useLastFocused', () => {
  it('tracks the last control that took focus', () => {
    render(
      <div>
        <button type="button">First</button>
        <button type="button">Second</button>
      </div>,
    );

    screen.getByRole('button', { name: 'First' }).focus();
    expect(lastFocusedElement()).toBe(screen.getByRole('button', { name: 'First' }));

    screen.getByRole('button', { name: 'Second' }).focus();
    expect(lastFocusedElement()).toBe(screen.getByRole('button', { name: 'Second' }));
  });

  it('keeps the last control when focus falls back to the body', () => {
    render(<button type="button">First</button>);
    const first = screen.getByRole('button', { name: 'First' });

    first.focus();
    first.blur();

    expect(document.activeElement).toBe(document.body);
    expect(lastFocusedElement()).toBe(first);
  });

  it('never reports the body', () => {
    document.body.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    expect(lastFocusedElement()).not.toBe(document.body);
  });

  it('survives the unmount of the component that read it', () => {
    let read: () => HTMLElement | null = () => null;
    const view = render(
      <div>
        <Probe onRead={(next) => (read = next)} />
        <button type="button">Outside</button>
      </div>,
    );
    screen.getByRole('button', { name: 'Outside' }).focus();

    view.rerender(
      <div>
        {null}
        <button type="button">Outside</button>
      </div>,
    );

    expect(screen.queryByRole('button', { name: 'Probe' })).toBeNull();
    expect(read()).toBe(screen.getByRole('button', { name: 'Outside' }));
  });

  it('drops a control that left the document', () => {
    const view = render(<button type="button">Gone</button>);
    screen.getByRole('button', { name: 'Gone' }).focus();

    view.unmount();

    expect(lastFocusedElement()).toBeNull();
  });
});
