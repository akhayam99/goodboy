// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"navigation":{"disableChildFrameNavigation":true}}}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DemoPlayground } from './DemoPlayground';
import { DEMO_CHAPTERS } from './demoChapters';

const STAGE_BOX = new DOMRect(0, 0, 1440, 900);

const railOf = (): HTMLElement => screen.getByRole('navigation', { name: 'Playground groups' });

const playgroundRoot = (): HTMLElement => {
  const root = screen.getByRole('heading', { level: 1 }).closest<HTMLElement>('[tabindex="-1"]');
  if (root === null) {
    throw new Error('missing playground root');
  }
  return root;
};

const currentStep = (): string =>
  document.querySelector('ol button[aria-current="step"]')?.textContent ?? '';

type StateParams = {
  readonly name: string;
};

const stateOf = ({ name }: StateParams): string | null =>
  within(railOf()).getByRole('button', { name }).getAttribute('data-state');

beforeEach(() => {
  window.sessionStorage.clear();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(STAGE_BOX);
  window.history.replaceState(null, '', '/?scene=demo');
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.spyOn(Animation.prototype, 'cancel').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('demo rail steps', () => {
  it('lists the steps under the open group only and keeps the other groups to a title and a count', () => {
    window.history.replaceState(null, '', '/?scene=demo#orchestrate');
    render(<DemoPlayground />);
    const steps = within(railOf()).getByRole('list', { name: 'Steps in this group' });
    const labels = Array.from(steps.querySelectorAll('button')).map((step) => step.textContent);
    expect(labels).toEqual(DEMO_CHAPTERS[2]?.beats.map((beat) => beat.label));
    expect(within(railOf()).getAllByRole('list')).toHaveLength(1);
    const rows = Array.from(railOf().querySelectorAll('button[data-up-next]'));
    const agentRow = rows.find((row) => row.textContent?.includes('Work with an agent'));
    expect(agentRow?.textContent).toContain('0 of');
  });

  it('highlights the active step and checks the ones the visitor has seen', () => {
    window.history.replaceState(null, '', '/?scene=demo#orchestrate');
    render(<DemoPlayground />);
    expect(stateOf({ name: 'Auto starts' })).toBe('current');
    expect(stateOf({ name: 'Auto plans' })).toBe('todo');
    fireEvent.click(within(railOf()).getByRole('button', { name: 'Auto plans' }));
    expect(stateOf({ name: 'Auto starts' })).toBe('done');
    expect(stateOf({ name: 'Auto plans' })).toBe('current');
    expect(currentStep()).toBe('Auto plans');
  });

  it('keeps the seen steps in the tab', () => {
    window.history.replaceState(null, '', '/?scene=demo#orchestrate');
    const view = render(<DemoPlayground />);
    fireEvent.click(within(railOf()).getByRole('button', { name: 'Auto plans' }));
    view.unmount();
    render(<DemoPlayground />);
    expect(stateOf({ name: 'Auto starts' })).toBe('current');
    expect(stateOf({ name: 'Auto plans' })).toBe('done');
  });

  it('moves through the steps with the up and down keys and stays inside the group', () => {
    window.history.replaceState(null, '', '/?scene=demo#agent');
    render(<DemoPlayground />);
    fireEvent.keyDown(playgroundRoot(), { key: 'ArrowUp' });
    expect(currentStep()).toBe(DEMO_CHAPTERS[1]?.beats[0]?.label);
    fireEvent.keyDown(playgroundRoot(), { key: 'ArrowDown' });
    expect(currentStep()).toBe(DEMO_CHAPTERS[1]?.beats[1]?.label);
    fireEvent.keyDown(playgroundRoot(), { key: 'ArrowDown' });
    fireEvent.keyDown(playgroundRoot(), { key: 'ArrowDown' });
    expect(currentStep()).toBe(DEMO_CHAPTERS[1]?.beats.at(-1)?.label);
    expect(window.location.hash).toBe('#agent');
  });

  it('offers a compact group and step switcher for narrow windows', () => {
    window.history.replaceState(null, '', '/?scene=demo#orchestrate');
    render(<DemoPlayground />);
    const compact = screen.getByRole('navigation', { name: 'Playground navigation' });
    expect(compact.textContent).toContain('Orchestrate');
    expect(compact.textContent).toContain('3 of 5');
    fireEvent.click(within(compact).getByRole('button', { name: 'Auto plans' }));
    expect(currentStep()).toBe('Auto plans');
    fireEvent.click(within(compact).getByRole('button', { name: 'Previous group' }));
    expect(window.location.hash).toBe('#agent');
  });

  it('has no timeline bar at the bottom of the stage', () => {
    render(<DemoPlayground />);
    expect(screen.queryByRole('button', { name: 'Replay group' })).toBeNull();
    expect(screen.queryAllByRole('list', { name: 'Steps in this group' })).toHaveLength(1);
  });
});
