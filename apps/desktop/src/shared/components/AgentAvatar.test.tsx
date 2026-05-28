// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { AgentAvatar } from './AgentAvatar';

afterEach(cleanup);

describe('AgentAvatar', () => {
  it('renders a masked span with a kind portrait', () => {
    const { container } = render(<AgentAvatar kind="planner" />);
    const span = container.querySelector('span');
    expect(span).not.toBeNull();
    expect(span?.style.maskImage).toMatch(/url\(/);
  });

  it('falls back to a plain dot when the kind has no portrait', () => {
    const { container } = render(<AgentAvatar kind="resolver" />);
    const span = container.querySelector('span');
    expect(span).not.toBeNull();
    expect(span?.style.maskImage).toBeFalsy();
  });

  it('applies the title attribute when provided', () => {
    const { container } = render(<AgentAvatar kind="scout" title="explorer" />);
    expect(container.querySelector('[title="explorer"]')).not.toBeNull();
  });
});
