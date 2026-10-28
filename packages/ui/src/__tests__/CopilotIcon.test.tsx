// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { CopilotIcon } from '../components/CopilotIcon';

afterEach(cleanup);

describe('CopilotIcon', () => {
  it('draws the two shapes of the 24 pixel Octicons mark on the shared 24 grid', () => {
    const { container } = render(<CopilotIcon />);

    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg?.getAttribute('fill')).toBe('currentColor');
    const paths = container.querySelectorAll('path');
    expect(paths).toHaveLength(2);
    expect(paths[0]?.getAttribute('d')?.startsWith('M23.922 16.992')).toBe(true);
    expect(paths[1]?.getAttribute('d')?.startsWith('M14.5 14.25a1 1 0 0 1 1 1v2')).toBe(true);
  });

  it('takes the size from its prop and drops stroke props the other brand marks drop', () => {
    const { container } = render(<CopilotIcon size={16} strokeWidth={3} />);

    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('16');
    expect(svg?.getAttribute('height')).toBe('16');
    expect(svg?.hasAttribute('stroke-width')).toBe(false);
  });
});
