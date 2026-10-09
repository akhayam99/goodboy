// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ProviderId } from '@goodboy/types';
import type { WorkDrafterChoice } from '../../workDrafter';
import { DraftedBy } from './DraftedBy';

const CONNECTED: ReadonlyArray<ProviderId> = ['anthropic', 'codex'];

afterEach(cleanup);

const open = (choice: WorkDrafterChoice) => {
  const onChange = vi.fn<(next: WorkDrafterChoice) => void>();
  render(<DraftedBy choice={choice} connectedProviders={CONNECTED} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: /^Drafted by:/ }));
  return { onChange, dialog: within(screen.getByRole('dialog', { name: 'Drafted by' })) };
};

describe('DraftedBy', () => {
  it('hands a provider switch over as one choice and leaves the effort unset', () => {
    const { onChange, dialog } = open({ provider: 'anthropic', model: 'sonnet-5' });

    fireEvent.click(dialog.getByRole('button', { name: 'Codex' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const [next] = onChange.mock.calls[0] ?? [];
    expect(next?.provider).toBe('codex');
    expect(next).not.toHaveProperty('effort');
  });

  it('records the effort once the pick changes it', () => {
    const { onChange, dialog } = open({ provider: 'anthropic', model: 'sonnet-5' });

    fireEvent.click(dialog.getByRole('button', { name: 'High' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'anthropic', model: 'sonnet-5', effort: 'high' }),
    );
  });
});
