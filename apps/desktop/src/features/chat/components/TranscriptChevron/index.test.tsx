// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { TranscriptChevron } from './index';

afterEach(cleanup);

describe('TranscriptChevron', () => {
  it('stays unrotated while collapsed', () => {
    render(<TranscriptChevron open={false} />);
    expect(screen.getByTestId('transcript-chevron').getAttribute('class')).not.toContain(
      'rotate-90',
    );
  });

  it('rotates when open', () => {
    render(<TranscriptChevron open />);
    expect(screen.getByTestId('transcript-chevron').getAttribute('class')).toContain('rotate-90');
  });

  it('never carries a state color', () => {
    render(<TranscriptChevron open />);
    expect(screen.getByTestId('transcript-chevron').getAttribute('class')).toContain(
      'text-muted-foreground/60',
    );
  });
});
