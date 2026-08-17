// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkflowStarter } from './index';

afterEach(cleanup);

type Params = { readonly isWorking?: boolean };

const renderStarter = ({ isWorking = false }: Params = {}) => {
  const onExample = vi.fn();
  render(
    <WorkflowStarter
      prompt="Review authentication changes"
      isWorking={isWorking}
      error={null}
      providerReason={null}
      onPromptChange={vi.fn()}
      onExample={onExample}
      onCreate={vi.fn()}
      onBlank={vi.fn()}
    />,
  );
  return { onExample };
};

describe('WorkflowStarter', () => {
  it('fills the full prompt from a short example action', () => {
    const { onExample } = renderStarter();

    fireEvent.click(screen.getByRole('button', { name: 'Fix a bug' }));

    expect(onExample).toHaveBeenCalledWith(
      'Investigate a bug, fix the root cause, and add regression tests',
    );
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
