// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useDropdown } from '@goodboy/ui';
import { SettingChip } from '../../../../shared/components/SettingChip';
import { glanceOf } from '../../glance/glanceOf';
import { RunGlanceLine } from '.';

afterEach(cleanup);

const OPEN_LIMIT = 'goodboy:test-open-limit';

const LimitFact = () => {
  const dropdown = useDropdown({ expectedHeight: 240, openEvent: OPEN_LIMIT });
  return (
    <SettingChip
      dropdown={dropdown}
      label="Limit"
      words={{ value: '$10.00', source: 'this Lead', chain: 'This Lead $10.00.' }}
      help="What this Lead may spend."
      error={null}
    >
      <span>Limit form</span>
    </SettingChip>
  );
};

const mount = ({ spend }: { readonly spend: string | null }) =>
  render(
    <RunGlanceLine
      glance={glanceOf({ state: 'running', sentence: '1 of 3 steps' })}
      spend={spend}
      settings={<LimitFact />}
      trailing={<button type="button">Stop run</button>}
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
        glance={glanceOf({ state: 'running', sentence: '' })}
        spend={null}
        settings={null}
      />,
    );

    expect(screen.getByRole('status').textContent).toBe('Running');
  });

  it('announces the word and the sentence, not the spend or the settings', () => {
    mount({ spend: '$1.20 of $5.00' });

    const status = screen.getByRole('status');
    expect(status.textContent).toBe('Running·1 of 3 steps');
    expect(status.contains(screen.getByText('$1.20 of $5.00'))).toBe(false);
    expect(status.contains(screen.getByRole('button', { name: /^Limit: / }))).toBe(false);
  });

  it('says each setting as a word in the line, with no panel and no Settings toggle', () => {
    const { container } = mount({ spend: null });
    const fact = screen.getByRole('button', { name: 'Limit: $10.00, this Lead' });

    expect(fact.textContent).toBe('Limit $10.00');
    expect(fact.getAttribute('data-variant')).toBe('fact');
    expect(screen.queryByRole('button', { name: 'Run settings' })).toBeNull();
    expect(container.querySelector('[id^="run-settings-"]')).toBeNull();
  });

  it('opens one setting at a time from its word', () => {
    mount({ spend: null });
    const fact = screen.getByRole('button', { name: 'Limit: $10.00, this Lead' });

    fireEvent.click(fact);

    expect(fact.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('dialog', { name: 'Limit' }).textContent).toContain('Limit form');
  });

  it('opens a setting from its open event, since the word is always on screen', () => {
    mount({ spend: null });

    act(() => {
      window.dispatchEvent(new Event(OPEN_LIMIT));
    });

    screen.getByRole('dialog', { name: 'Limit' });
  });

  it('keeps the action after the settings, outside the announced status', () => {
    mount({ spend: null });
    const stop = screen.getByRole('button', { name: 'Stop run' });

    expect(stop.closest('[data-glance-actions]')).not.toBeNull();
    expect(screen.getByRole('status').contains(stop)).toBe(false);
  });

  it('draws no spend when there is nothing to say', () => {
    mount({ spend: null });

    expect(screen.queryByText(/^\$/)).toBeNull();
  });
});
