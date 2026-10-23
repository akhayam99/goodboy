// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AutoLimitChip } from './AutoLimitChip';

afterEach(cleanup);

describe('AutoLimitChip', () => {
  it('shows the limit, opens a field and hands back a valid amount', () => {
    const onChange = vi.fn();
    render(<AutoLimitChip usd={5} isFromSession={false} isDisabled={false} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Limit $5.00' }));
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '8' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Use this limit' }));

    expect(onChange).toHaveBeenCalledWith(8);
  });

  it('takes an amount with cents typed into the field', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<AutoLimitChip usd={5} isFromSession={false} isDisabled={false} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Limit $5.00' }));
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), '2.50');
    await user.click(screen.getByRole('button', { name: 'Use this limit' }));

    expect(onChange).toHaveBeenCalledWith(2.5);
  });

  it('refuses an amount that is not above zero and says so', () => {
    const onChange = vi.fn();
    render(<AutoLimitChip usd={5} isFromSession={false} isDisabled={false} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Limit $5.00' }));
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '0' },
    });

    expect(screen.getByText('Enter an amount more than zero.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Use this limit' })).toHaveProperty('disabled', true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('is a plain chip when the budget of the session sets the limit', () => {
    render(<AutoLimitChip usd={25} isFromSession isDisabled={false} onChange={vi.fn()} />);

    expect(screen.getByText('Limit $25.00')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Limit $25.00' })).toBeNull();
  });
});
