// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StepDropZone } from './StepDropZone';

afterEach(cleanup);

const renderZone = ({ index }: { readonly index: number }) =>
  render(
    <ol>
      <StepDropZone index={index} isActive={false} identityIndex={0} />
    </ol>,
  );

describe('StepDropZone', () => {
  it('draws no lane above the first step', () => {
    const { container } = renderZone({ index: 0 });

    expect(container.querySelector('line')).toBeNull();
  });

  it('keeps the lane through the zones between and after steps', () => {
    const { container } = renderZone({ index: 2 });

    expect(container.querySelector('line')).not.toBeNull();
  });
});
