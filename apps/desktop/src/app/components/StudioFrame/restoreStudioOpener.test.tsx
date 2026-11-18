// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { StudioFrame } from './index';

afterEach(cleanup);

type SceneProps = {
  readonly frameKey: string | null;
};

const Scene = ({ frameKey }: SceneProps) => (
  <>
    <button type="button" data-shell-rail-item="settings">
      Settings
    </button>
    {frameKey === null ? null : (
      <StudioFrame key={frameKey} kind="settings" onClose={() => undefined}>
        <p>settings body</p>
      </StudioFrame>
    )}
  </>
);

describe('restoreStudioOpener', () => {
  it('leaves focus alone when the same studio mounts again in place', () => {
    const { rerender } = render(<Scene frameKey="first" />);

    rerender(<Scene frameKey="second" />);

    expect(document.activeElement).toBe(document.body);
    expect(screen.getByText('settings body').isConnected).toBe(true);
  });

  it('returns focus to the rail place once the studio closes', () => {
    const { rerender } = render(<Scene frameKey="first" />);

    rerender(<Scene frameKey={null} />);

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Settings' }));
  });
});
