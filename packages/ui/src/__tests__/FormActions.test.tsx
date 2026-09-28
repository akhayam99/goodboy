// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FormActions } from '../components/FormActions';
import { FormPage } from '../components/FormPage';

afterEach(cleanup);

describe('FormActions', () => {
  it('puts the secondary before the primary in one right-aligned group', () => {
    render(
      <FormActions>
        <button type="button">Discard</button>
        <button type="button">Start</button>
      </FormActions>,
    );

    const discard = screen.getByRole('button', { name: 'Discard' });
    const start = screen.getByRole('button', { name: 'Start' });
    expect(discard.parentElement).toBe(start.parentElement);
    expect(discard.parentElement?.className).toContain('ml-auto');
    expect(discard.compareDocumentPosition(start) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('runs the actions it is given', () => {
    const onStart = vi.fn();
    const onDiscard = vi.fn();
    render(
      <FormActions>
        <button type="button" onClick={onDiscard}>
          Discard
        </button>
        <button type="button" onClick={onStart}>
          Start
        </button>
      </FormActions>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(onDiscard).toHaveBeenCalledOnce();
    expect(onStart).toHaveBeenCalledOnce();
  });

  it('draws no divider, border or footer bar', () => {
    const { container } = render(
      <FormActions leading={<span>Starts now</span>}>
        <button type="button">Start</button>
      </FormActions>,
    );

    expect(container.querySelector('footer')).toBeNull();
    expect(container.querySelector('[role="separator"]')).toBeNull();
    expect(container.innerHTML).not.toContain('border-t');
    expect(container.innerHTML).not.toContain('sticky');
  });

  it('keeps the options on the left of the actions', () => {
    render(
      <FormActions leading={<span>Spend cap</span>}>
        <button type="button">Start</button>
      </FormActions>,
    );

    const option = screen.getByText('Spend cap');
    const start = screen.getByRole('button', { name: 'Start' });
    expect(option.compareDocumentPosition(start) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('says why the primary is blocked under the actions', () => {
    render(
      <FormActions reason="Write a goal first" reasonId="why">
        <button type="button" disabled aria-describedby="why">
          Start
        </button>
      </FormActions>,
    );

    expect(screen.getByText('Write a goal first').id).toBe('why');
  });

  it('announces an error', () => {
    render(
      <FormActions error="The provider refused">
        <button type="button">Start</button>
      </FormActions>,
    );

    expect(screen.getByRole('alert').textContent).toBe('The provider refused');
  });
});

describe('FormPage', () => {
  it('stacks the form on the pane column', () => {
    const { container } = render(
      <FormPage>
        <input aria-label="Goal" />
      </FormPage>,
    );

    const column = container.querySelector('[data-slot="form-page"]');
    expect(column?.className).toContain('max-w-[var(--column-max)]');
    expect(column?.className).toContain('gap-8');
    expect(screen.getByRole('textbox', { name: 'Goal' })).toBeDefined();
  });
});
