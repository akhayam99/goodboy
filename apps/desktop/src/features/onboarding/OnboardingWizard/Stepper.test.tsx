import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Stepper, stepAnnouncement } from './Stepper';

afterEach(cleanup);

const statesOf = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-state]')).map((node) =>
    node.getAttribute('data-state'),
  );

describe('Stepper', () => {
  it('labels the four steps and marks done, current and later', () => {
    const { container } = render(<Stepper current="tools" />);
    expect(statesOf(container)).toEqual(['done', 'done', 'current', 'later']);
    expect(container.querySelector('[aria-current="step"]')?.textContent).toContain('Tools');
    ['Agents', 'Workspace', 'Tools', 'First session'].forEach((label) => {
      expect(screen.getByText(label)).toBeDefined();
    });
  });

  it('says Tools is optional and keeps it there', () => {
    const { container } = render(<Stepper current="agents" />);
    expect(screen.getByText('Optional')).toBeDefined();
    expect(statesOf(container)).toHaveLength(4);
  });

  it('shows every step as later on Welcome, so the top bar never pops in', () => {
    const { container } = render(<Stepper current="welcome" />);
    expect(statesOf(container)).toEqual(['later', 'later', 'later', 'later']);
  });

  it('draws a check on a done step and the number on the others', () => {
    const { container } = render(<Stepper current="workspace" />);
    const nodes = Array.from(container.querySelectorAll('li > span:first-child'));
    expect(nodes[0]?.querySelector('svg')).not.toBeNull();
    expect(nodes.slice(1).map((node) => node.textContent)).toEqual(['2', '3', '4']);
  });

  it('announces the position out of four for screen readers', () => {
    expect(stepAnnouncement({ current: 'tools' })).toBe('Step 3 of 4, Tools');
    expect(stepAnnouncement({ current: 'welcome' })).toBe('');
  });
});
