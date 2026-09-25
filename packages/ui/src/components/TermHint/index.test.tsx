// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TermHint } from './index';

const renderHint = ({ onAct }: { readonly onAct?: () => void }) =>
  render(
    <div>
      <TermHint
        term="Workflow"
        definition="Several agents that run one after another."
        {...(onAct === undefined ? {} : { action: { label: 'Open the guide', onAct } })}
      >
        workflow
      </TermHint>
      <button type="button">Elsewhere</button>
    </div>,
  );

describe('TermHint', () => {
  afterEach(cleanup);

  it('stays closed until the word is clicked', () => {
    renderHint({});

    expect(screen.queryByRole('dialog', { name: 'Workflow' })).toBeNull();
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'workflow' }));
    expect(screen.queryByRole('dialog', { name: 'Workflow' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'workflow' }));

    const dialog = screen.getByRole('dialog', { name: 'Workflow' });
    expect(dialog.textContent).toContain('Several agents that run one after another.');
    expect(screen.getByRole('button', { name: 'workflow' }).getAttribute('aria-expanded')).toBe(
      'true',
    );
  });

  it('closes on a second click and when focus moves away', () => {
    renderHint({});
    const trigger = screen.getByRole('button', { name: 'workflow' });

    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByRole('dialog', { name: 'Workflow' })).toBeNull();

    fireEvent.click(trigger);
    fireEvent.blur(trigger, { relatedTarget: screen.getByRole('button', { name: 'Elsewhere' }) });
    expect(screen.queryByRole('dialog', { name: 'Workflow' })).toBeNull();
  });

  it('runs its action and closes', () => {
    const onAct = vi.fn();
    renderHint({ onAct });

    fireEvent.click(screen.getByRole('button', { name: 'workflow' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open the guide' }));

    expect(onAct).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'Workflow' })).toBeNull();
  });
});
