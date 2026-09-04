// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session, SessionId } from '@goodboy/types';

const SESSION_ID = 'ses-1' as SessionId;

const setActiveLens = vi.fn();

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: { setActiveLens: typeof setActiveLens }) => T) =>
    selector({ setActiveLens }),
}));

const { SessionEyebrow } = await import('.');

const sessionWith = ({ goal }: { readonly goal: string }): Session =>
  ({ id: SESSION_ID, goal }) as unknown as Session;

beforeEach(() => {
  setActiveLens.mockClear();
});

afterEach(cleanup);

describe('SessionEyebrow', () => {
  it('renders the session title with the full text on the tooltip', () => {
    render(<SessionEyebrow session={sessionWith({ goal: 'Ship the lens eyebrow' })} />);

    const button = screen.getByRole('button', { name: 'Ship the lens eyebrow' });
    expect(button.getAttribute('title')).toBe('Ship the lens eyebrow');
  });

  it('falls back to the untitled label when the session has no goal', () => {
    render(<SessionEyebrow session={sessionWith({ goal: '' })} />);

    expect(screen.getByRole('button', { name: 'Untitled session' })).toBeDefined();
  });

  it('navigates back to the session overview on click', () => {
    render(<SessionEyebrow session={sessionWith({ goal: 'Ship the lens eyebrow' })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ship the lens eyebrow' }));

    expect(setActiveLens).toHaveBeenCalledWith(SESSION_ID, null);
  });

  it('renders inline markdown in the goal and strips it from the title', () => {
    const { container } = render(
      <SessionEyebrow session={sessionWith({ goal: 'fix `auth` bug' })} />,
    );

    const code = container.querySelector('code');
    expect(code?.textContent).toBe('auth');

    const button = container.querySelector('button');
    expect(button?.getAttribute('title')).toBe('fix auth bug');
    expect(button?.getAttribute('title')).not.toContain('`');
  });
});
