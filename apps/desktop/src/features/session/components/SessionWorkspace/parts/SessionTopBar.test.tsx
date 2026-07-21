// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

vi.mock('../../../../workspace/components/SessionDetailPanel', () => ({
  SessionDetailPanel: () => <div>session details</div>,
}));

import { SessionTopBar } from './SessionTopBar';

const SESSION = { goal: 'test session' } as Session;

afterEach(cleanup);

describe('SessionTopBar', () => {
  it('renders the session details', () => {
    render(<SessionTopBar session={SESSION} />);
    expect(screen.getByText('session details')).toBeDefined();
  });
});
