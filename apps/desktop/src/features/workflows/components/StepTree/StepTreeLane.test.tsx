// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StepTreeLane, type StepLaneSpan } from './StepTreeLane';

afterEach(cleanup);

const lineOf = ({ span }: { readonly span: StepLaneSpan }) => {
  const { container } = render(<StepTreeLane span={span} identityIndex={0} />);
  return container.querySelector('line');
};

describe('StepTreeLane', () => {
  it('draws the origin from the node centre down to the row end', () => {
    const line = lineOf({ span: 'origin' });

    expect(line?.getAttribute('y1')).toBe('16');
    expect(line?.getAttribute('y2')).toBe('100%');
  });

  it('draws the tip from the row start down to the node centre', () => {
    const line = lineOf({ span: 'tip' });

    expect(line?.getAttribute('y1')).toBe('0');
    expect(line?.getAttribute('y2')).toBe('16');
  });

  it('draws a through span over the whole row', () => {
    const line = lineOf({ span: 'through' });

    expect(line?.getAttribute('y1')).toBe('0');
    expect(line?.getAttribute('y2')).toBe('100%');
  });

  it('draws nothing for the none span', () => {
    expect(lineOf({ span: 'none' })).toBeNull();
  });
});
