// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FirstSessionStep } from './FirstSessionStep';

afterEach(cleanup);

const renderStep = ({ hasIssueSource = false } = {}) => {
  const handlers = {
    onStartScout: vi.fn(),
    onHandOff: vi.fn(),
    onBackToCodeHost: vi.fn(),
    onConnectTaskManager: vi.fn(),
  };
  render(
    <FirstSessionStep
      projectName="ledger-core"
      hasIssueSource={hasIssueSource}
      busy={false}
      {...handlers}
    />,
  );
  return handlers;
};

describe('FirstSessionStep', () => {
  it('opens on Ask an agent with the first starter written out for the project', () => {
    renderStep();
    expect(screen.getByRole('tab', { name: /ask an agent/i }).getAttribute('aria-selected')).toBe(
      'true',
    );
    const field = screen.getByRole('textbox', {
      name: 'What Scout should do',
    }) as HTMLTextAreaElement;
    expect(field.value).toContain('Explain how ledger-core is organized');
  });

  it('swaps the prompt when another starter is picked, and starts Scout with it', () => {
    const { onStartScout } = renderStep();
    fireEvent.click(screen.getByRole('button', { name: 'Find one small bug' }));
    fireEvent.click(screen.getByRole('button', { name: /start scout/i }));
    expect(onStartScout).toHaveBeenCalledWith(
      "Find one small bug in ledger-core and propose a fix. Don't change any files yet.",
    );
  });

  it('says there is no issue source and leads back to Code host', () => {
    const { onBackToCodeHost, onConnectTaskManager } = renderStep();
    fireEvent.click(screen.getByRole('tab', { name: /pick up a task/i }));
    expect(screen.getByText('Connect a code host to see your tasks')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Code host' }));
    fireEvent.click(screen.getByRole('button', { name: 'Connect a task manager' }));
    expect(onBackToCodeHost).toHaveBeenCalledOnce();
    expect(onConnectTaskManager).toHaveBeenCalledOnce();
  });

  it('hands a task start to a new session when an issue source exists', () => {
    const { onHandOff } = renderStep({ hasIssueSource: true });
    fireEvent.click(screen.getByRole('tab', { name: /pick up a task/i }));
    expect(screen.queryByText('Connect a code host to see your tasks')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open a new session' }));
    expect(onHandOff).toHaveBeenCalledWith('task');
  });

  it('moves between the three choices with the arrow keys', () => {
    renderStep();
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: /pick up a task/i }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });
});
