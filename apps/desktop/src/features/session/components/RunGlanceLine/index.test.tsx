// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { glanceOf } from '../../glance/glanceOf';
import { RunGlanceLine } from '.';

afterEach(cleanup);

const mount = ({ spend }: { readonly spend: string | null }) =>
  render(
    <RunGlanceLine
      id="agent-ledger-core"
      glance={glanceOf({ state: 'running', sentence: '1 of 3 steps' })}
      spend={spend}
      settings={<span>Model chips</span>}
    />,
  );

describe('RunGlanceLine', () => {
  it('draws the state word, the sentence and the spend of the limit', () => {
    mount({ spend: '$1.20 of $5.00' });

    expect(screen.getByText('Running').textContent).toBe('Running');
    expect(screen.getByText('1 of 3 steps').textContent).toBe('1 of 3 steps');
    expect(screen.getByText('$1.20 of $5.00').textContent).toBe('$1.20 of $5.00');
  });

  it('draws the word alone when the sentence is empty', () => {
    render(
      <RunGlanceLine
        id="agent-ledger-core"
        glance={glanceOf({ state: 'running', sentence: '' })}
        spend={null}
        settings={<span>Model chips</span>}
      />,
    );

    expect(screen.getByRole('status').textContent).toBe('Running');
  });

  it('announces the word and the sentence, not the spend or the Settings button', () => {
    mount({ spend: '$1.20 of $5.00' });

    const status = screen.getByRole('status');
    expect(status.textContent).toBe('Running·1 of 3 steps');
    expect(status.contains(screen.getByText('$1.20 of $5.00'))).toBe(false);
    expect(status.contains(screen.getByRole('button', { name: 'Run settings' }))).toBe(false);
  });

  it.each(['goodboy:open-model-picker', 'goodboy:open-permission-picker'])(
    'opens the chips first when %s fires, so the popover has an anchor',
    (name) => {
      const { container } = mount({ spend: null });
      const panel = container.querySelector('#run-settings-agent-ledger-core');

      expect(panel?.getAttribute('data-open')).toBe('false');
      act(() => {
        window.dispatchEvent(new Event(name));
      });

      expect(panel?.getAttribute('data-open')).toBe('true');
    },
  );

  it('opens the chips for the event the caller names, and for no other', () => {
    const { container } = render(
      <RunGlanceLine
        id="agent-ledger-core"
        glance={glanceOf({ state: 'running', sentence: '' })}
        spend={null}
        settings={<span>Model chips</span>}
        revealEvent="goodboy:test-open-limit"
      />,
    );
    const panel = container.querySelector('#run-settings-agent-ledger-core');

    act(() => {
      window.dispatchEvent(new Event('goodboy:test-other'));
    });
    expect(panel?.getAttribute('data-open')).toBe('false');
    act(() => {
      window.dispatchEvent(new Event('goodboy:test-open-limit'));
    });

    expect(panel?.getAttribute('data-open')).toBe('true');
  });

  it('stops listening once it is gone', () => {
    const { container, unmount } = mount({ spend: null });
    const panel = container.querySelector('#run-settings-agent-ledger-core');
    unmount();

    window.dispatchEvent(new Event('goodboy:open-model-picker'));

    expect(panel?.getAttribute('data-open')).toBe('false');
  });

  it('draws no spend when there is nothing to say', () => {
    mount({ spend: null });

    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('keeps the chips behind Settings and opens them inline', () => {
    const { container } = mount({ spend: null });
    const button = screen.getByRole('button', { name: 'Run settings' });
    const panel = container.querySelector('#run-settings-agent-ledger-core');

    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(panel?.getAttribute('data-open')).toBe('false');

    fireEvent.click(button);

    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(panel?.getAttribute('data-open')).toBe('true');
    expect(panel?.textContent).toBe('Model chips');
  });
});
