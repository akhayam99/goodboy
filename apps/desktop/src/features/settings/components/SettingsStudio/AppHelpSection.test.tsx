// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { openUrl } = vi.hoisted(() => ({ openUrl: vi.fn(async () => undefined) }));

vi.mock('../../../../shared/lib/editor', () => ({ openUrl }));

import { AppHelpSection } from './AppHelpSection';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AppHelpSection', () => {
  it('opens the Goodboy X profile from the follow row', () => {
    render(<AppHelpSection requestClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Follow on X' }));

    expect(openUrl).toHaveBeenCalledExactlyOnceWith('https://x.com/GoodboyWorks');
  });
});
