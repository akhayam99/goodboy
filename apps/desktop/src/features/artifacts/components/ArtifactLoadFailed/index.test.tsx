// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ArtifactLoadFailed } from './index';

afterEach(cleanup);

describe('ArtifactLoadFailed', () => {
  it("says Couldn't load with the thing that failed, and Retry", () => {
    const onRetry = vi.fn();
    render(<ArtifactLoadFailed label="revisions" onRetry={onRetry} />);

    expect(screen.getByRole('alert').textContent).toContain("Couldn't load revisions");
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
