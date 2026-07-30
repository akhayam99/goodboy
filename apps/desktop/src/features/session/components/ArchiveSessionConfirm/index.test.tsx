// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { BulkArchiveSessionsConfirm } from '../BulkArchiveSessionsConfirm';

type InlineConfirmProps = {
  readonly role: string;
  readonly title: string;
  readonly children: ReactNode;
};

vi.mock('@goodboy/ui', () => ({
  InlineConfirm: ({ role, title, children }: InlineConfirmProps) => (
    <div data-confirm-role={role}>
      {title}
      {children}
    </div>
  ),
  ScrollFade: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../../store', () => ({
  useAppStore: (
    selector: (state: {
      archiveTask: ReturnType<typeof vi.fn>;
      bulkArchiveTask: ReturnType<typeof vi.fn>;
    }) => unknown,
  ) =>
    selector({
      archiveTask: vi.fn(async () => undefined),
      bulkArchiveTask: vi.fn(async () => undefined),
    }),
}));

import { ArchiveSessionConfirm } from '.';

afterEach(cleanup);

describe('archive confirmation roles', () => {
  it('uses the alert role for single and bulk archive', () => {
    const session = { id: 'session-1', goal: 'Ship it' } as never;
    render(
      <>
        <ArchiveSessionConfirm session={session} onClose={vi.fn()} />
        <BulkArchiveSessionsConfirm sessions={[session]} onClose={vi.fn()} />
      </>,
    );

    expect(
      screen
        .getByText('Archive session?')
        .closest('[data-confirm-role]')
        ?.getAttribute('data-confirm-role'),
    ).toBe('alert');
    expect(
      screen
        .getByText('Archive 1 sessions?')
        .closest('[data-confirm-role]')
        ?.getAttribute('data-confirm-role'),
    ).toBe('alert');
  });
});
