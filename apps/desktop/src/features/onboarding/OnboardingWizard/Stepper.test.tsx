import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Stepper, stepAnnouncement } from './Stepper';

afterEach(cleanup);

const statesOf = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-state]')).map((node) =>
    node.getAttribute('data-state'),
  );

describe('Stepper', () => {
  it('labels the three steps and marks done, current and later', () => {
    const { container } = render(<Stepper current="workspace" />);
    expect(statesOf(container)).toEqual(['done', 'current', 'later']);
    expect(container.querySelector('[aria-current="step"]')?.textContent).toContain('Workspace');
    ['Agents', 'Workspace', 'First session'].forEach((label) => {
      expect(screen.getByText(label)).toBeDefined();
    });
    expect(screen.queryByText('Tools')).toBeNull();
    expect(screen.queryByText('Optional')).toBeNull();
  });

  it('keeps the Tools side step under First session', () => {
    const { container } = render(<Stepper current="tools" />);
    expect(statesOf(container)).toEqual(['done', 'done', 'current']);
    expect(container.querySelector('[aria-current="step"]')?.textContent).toContain(
      'First session',
    );
  });

  it('draws a check on a done step and the number on the others', () => {
    const { container } = render(<Stepper current="workspace" />);
    const nodes = Array.from(container.querySelectorAll('li > span:first-child'));
    expect(nodes[0]?.querySelector('svg')).not.toBeNull();
    expect(nodes.slice(1).map((node) => node.textContent)).toEqual(['2', '3']);
  });

  it('announces the position out of three for screen readers', () => {
    expect(stepAnnouncement({ current: 'first-session' })).toBe('Step 3 of 3, First session');
    expect(stepAnnouncement({ current: 'tools' })).toBe('');
  });
});
