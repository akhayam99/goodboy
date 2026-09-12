// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkflowStarter } from './index';

afterEach(cleanup);

type Params = {
  readonly isWorking?: boolean;
  readonly canGenerate?: boolean;
  readonly providerStatusText?: string | null;
};

const renderStarter = ({
  isWorking = false,
  canGenerate = true,
  providerStatusText = null,
}: Params = {}) => {
  const onExample = vi.fn();
  const onCreate = vi.fn();
  render(
    <WorkflowStarter
      prompt="Review authentication changes"
      isWorking={isWorking}
      error={null}
      canGenerate={canGenerate}
      providerStatusText={providerStatusText}
      onPromptChange={vi.fn()}
      onExample={onExample}
      onCreate={onCreate}
      onBlank={vi.fn()}
    />,
  );
  return { onExample, onCreate };
};

const createButton = () =>
  screen.getByRole('button', { name: /create with agent/i }) as HTMLButtonElement;

describe('WorkflowStarter', () => {
  it('fills the full prompt from a short example action', () => {
    const { onExample } = renderStarter();

    fireEvent.click(screen.getByRole('button', { name: 'Fix a bug' }));

    expect(onExample).toHaveBeenCalledWith(
      'Investigate a bug, fix the root cause, and add regression tests',
    );
  });

  it('lets nonblocking provider information stand without disabling generation', () => {
    const { onCreate } = renderStarter({
      providerStatusText: 'Anthropic is the only connected provider.',
    });

    expect(screen.getByText('Anthropic is the only connected provider.')).toBeDefined();
    expect(createButton().disabled).toBe(false);

    fireEvent.click(createButton());
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it('blocks generation only when no provider can run it', () => {
    renderStarter({
      canGenerate: false,
      providerStatusText: 'Connect a provider to create a workflow with an agent.',
    });

    expect(createButton().disabled).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Start blank' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('keeps the description visible and read-only while working', () => {
    renderStarter({ isWorking: true });

    const description = screen.getByRole('textbox', {
      name: 'Describe the workflow',
    }) as HTMLTextAreaElement;
    expect(description.value).toBe('Review authentication changes');
    expect(description.readOnly).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('Working on your workflow');
  });
});
