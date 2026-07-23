// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionExternalTask, SessionExternalTaskProvider } from '@goodboy/types';
import { ExternalTaskChip } from './index';

afterEach(cleanup);

function makeTask(overrides: Partial<SessionExternalTask> = {}): SessionExternalTask {
  return {
    sessionId: 'sess-1',
    provider: 'linear',
    externalId: 'ext-abc',
    identifier: 'GB-123',
    url: 'https://linear.app/goodboy/issue/GB-123',
    title: 'Improve preview metadata',
    createdAt: '2026-06-22T00:00:00.000Z',
    ...overrides,
  } as SessionExternalTask;
}

describe('ExternalTaskChip, full variant', () => {
  it('renders identifier and title text', () => {
    render(<ExternalTaskChip task={makeTask()} />);
    expect(screen.getByText('GB-123')).toBeDefined();
    expect(screen.getByText('Improve preview metadata')).toBeDefined();
  });

  it('exposes an aria-label naming the identifier and provider', () => {
    render(<ExternalTaskChip task={makeTask()} />);
    expect(screen.getByRole('button', { name: /open GB-123 in Linear studio/i })).toBeDefined();
  });

  it('sets the tooltip to "identifier: title"', () => {
    render(<ExternalTaskChip task={makeTask()} />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('title')).toBe('GB-123: Improve preview metadata');
  });
});

describe('ExternalTaskChip, icon variant', () => {
  it('renders the provider glyph but omits identifier and title text', () => {
    render(<ExternalTaskChip task={makeTask()} variant="icon" />);
    expect(screen.getByText('L')).toBeDefined();
    expect(screen.queryByText('GB-123')).toBeNull();
    expect(screen.queryByText('Improve preview metadata')).toBeNull();
  });

  it('is display-only with an accessible label and tooltip', () => {
    render(<ExternalTaskChip task={makeTask()} variant="icon" />);
    expect(screen.queryByRole('button')).toBeNull();
    const badge = screen.getByLabelText(/GB-123 from Linear/i);
    expect(badge.getAttribute('title')).toBe('GB-123: Improve preview metadata');
  });
});

describe('ExternalTaskChip, provider mapping', () => {
  const cases: ReadonlyArray<{
    provider: SessionExternalTaskProvider;
    glyph: string;
    label: RegExp;
    event: string;
  }> = [
    { provider: 'linear', glyph: 'L', label: /Linear/i, event: 'goodboy:open-linear-studio' },
    { provider: 'sentry', glyph: 'S', label: /Sentry/i, event: 'goodboy:open-sentry-studio' },
    { provider: 'gitlab', glyph: 'G', label: /GitLab/i, event: 'goodboy:open-gitlab-studio' },
    { provider: 'github', glyph: 'GH', label: /GitHub/i, event: 'goodboy:open-github-studio' },
  ];

  for (const { provider, glyph, label, event } of cases) {
    it(`renders the ${provider} glyph and label`, () => {
      render(<ExternalTaskChip task={makeTask({ provider, identifier: 'X-1' })} />);
      expect(screen.getByText(glyph)).toBeDefined();
      expect(screen.getByRole('button', { name: label })).toBeDefined();
    });

    it(`dispatches ${event} with the externalId on click`, () => {
      const listener = vi.fn();
      window.addEventListener(event, listener);
      render(<ExternalTaskChip task={makeTask({ provider, externalId: `${provider}-id` })} />);
      fireEvent.click(screen.getByRole('button'));
      expect(listener).toHaveBeenCalledOnce();
      const evt = listener.mock.calls[0]?.[0] as CustomEvent;
      expect(evt.detail).toEqual({ issueExternalId: `${provider}-id` });
      window.removeEventListener(event, listener);
    });
  }
});

describe('ExternalTaskChip, click behavior', () => {
  it('invokes a custom onClick instead of dispatching a studio event', () => {
    const onClick = vi.fn();
    const studioListener = vi.fn();
    window.addEventListener('goodboy:open-linear-studio', studioListener);
    render(<ExternalTaskChip task={makeTask()} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
    expect(studioListener).not.toHaveBeenCalled();
    window.removeEventListener('goodboy:open-linear-studio', studioListener);
  });

  it('does not dispatch a studio event from the display-only icon variant', () => {
    const listener = vi.fn();
    window.addEventListener('goodboy:open-sentry-studio', listener);
    render(<ExternalTaskChip task={makeTask({ provider: 'sentry' })} variant="icon" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener('goodboy:open-sentry-studio', listener);
  });
});
