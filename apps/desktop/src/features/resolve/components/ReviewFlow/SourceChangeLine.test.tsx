// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { SourceChangeLine } from './SourceChangeLine';

const SEGMENTS = [{ text: 'retry forever', isChanged: true }];

afterEach(cleanup);

describe('SourceChangeLine', () => {
  it('reads the old text as before without relying on the minus sign', () => {
    const { container } = render(<SourceChangeLine kind="del" segments={SEGMENTS} />);

    expect(container.textContent).toContain('Before: retry forever');
  });

  it('reads the new text as after without relying on the plus sign', () => {
    const { container } = render(<SourceChangeLine kind="add" segments={SEGMENTS} />);

    expect(container.textContent).toContain('After: retry forever');
  });
});
