// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { TranscriptCard } from './index';

afterEach(cleanup);

describe('TranscriptCard', () => {
  it('renders nothing for a run completion', () => {
    const { container } = render(<TranscriptCard item={{ kind: 'done', key: 'done-1' }} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders no separator for a run completion', () => {
    const { container } = render(<TranscriptCard item={{ kind: 'done', key: 'done-1' }} />);
    expect(container.querySelectorAll('[role="separator"]')).toHaveLength(0);
  });
});
