// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ConnectSteps } from './index';
import type { ConnectStepDef } from './Step';

afterEach(cleanup);

const STEPS: ReadonlyArray<ConnectStepDef> = [
  { id: 'one', title: 'Step one', status: 'done', content: <button type="button">One</button> },
  { id: 'two', title: 'Step two', status: 'current', content: <button type="button">Two</button> },
  {
    id: 'three',
    title: 'Step three',
    status: 'later',
    content: <button type="button">Three</button>,
  },
];

describe('ConnectSteps', () => {
  it('numbers the not-yet-done steps and checks the done one', () => {
    render(<ConnectSteps steps={STEPS} ariaLabel="Connect a tool" />);
    const list = screen.getByRole('list', { name: 'Connect a tool' });
    expect(list.textContent).toContain('2');
    expect(list.textContent).toContain('3');
  });

  it('keeps a later step visible instead of hiding its control', () => {
    render(<ConnectSteps steps={STEPS} ariaLabel="Connect a tool" />);
    const later = screen.getByText('Three');
    expect(later).toBeDefined();
    expect(later.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('shows every step title up front, not only the current one', () => {
    render(<ConnectSteps steps={STEPS} ariaLabel="Connect a tool" />);
    expect(screen.getByText('Step one')).toBeDefined();
    expect(screen.getByText('Step two')).toBeDefined();
    expect(screen.getByText('Step three')).toBeDefined();
  });
});
