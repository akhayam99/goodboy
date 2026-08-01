// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionExternalTask, SessionExternalTaskProvider } from '@goodboy/types';

const mocks = vi.hoisted(() => ({
  openUrl: vi.fn(async () => undefined),
}));

vi.mock('../../../../shared/lib/editor', () => ({
  openUrl: mocks.openUrl,
}));

import { ExternalTaskChip } from './index';

afterEach(() => {
  cleanup();
  mocks.openUrl.mockClear();
});

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
  it('renders the provider mark but omits identifier and title text', () => {
    render(<ExternalTaskChip task={makeTask()} variant="icon" />);
    expect(screen.getByRole('img', { name: 'Linear' })).toBeDefined();
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
    mark: string;
    label: RegExp;
  }> = [
    { provider: 'linear', mark: 'Linear', label: /Linear/i },
    { provider: 'sentry', mark: 'Sentry', label: /Sentry/i },
    { provider: 'gitlab', mark: 'GitLab', label: /GitLab/i },
    { provider: 'github', mark: 'GitHub', label: /GitHub/i },
  ];

  for (const { provider, mark, label } of cases) {
    it(`renders the ${provider} mark and label`, () => {
      render(<ExternalTaskChip task={makeTask({ provider, identifier: 'X-1' })} />);
      expect(screen.getByRole('img', { name: mark })).toBeDefined();
      expect(screen.getByRole('button', { name: label })).toBeDefined();
    });
  }
});

describe('ExternalTaskChip, row appearance', () => {
  it('renders identifier, title, and external reference actions driven by task.url', () => {
    const { container } = render(<ExternalTaskChip task={makeTask()} appearance="row" />);
    expect(screen.getByText('GB-123')).toBeDefined();
    expect(screen.getByText('Improve preview metadata')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Open in Linear' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Copy GB-123 link' })).toBeDefined();
    expect(container.querySelector('.lucide-arrow-up-right')).not.toBeNull();
  });

  it('omits the copy-link action when the task has no url', () => {
    render(<ExternalTaskChip task={makeTask({ url: '' })} appearance="row" />);
    expect(screen.queryByRole('button', { name: 'Copy GB-123 link' })).toBeNull();
  });

  it('opens the provider URL without dispatching a studio event from a row click', () => {
    const listener = vi.fn();
    window.addEventListener('goodboy:open-linear-studio', listener);
    render(<ExternalTaskChip task={makeTask()} appearance="row" />);
    fireEvent.click(screen.getByRole('button', { name: /open GB-123 in Linear/i }));
    expect(mocks.openUrl).toHaveBeenCalledWith('https://linear.app/goodboy/issue/GB-123');
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener('goodboy:open-linear-studio', listener);
  });

  it('honors a custom onClick and ariaLabel instead of the default studio dispatch', () => {
    const onClick = vi.fn();
    const studioListener = vi.fn();
    window.addEventListener('goodboy:open-linear-studio', studioListener);
    const { container } = render(
      <ExternalTaskChip
        task={makeTask()}
        appearance="row"
        navigation="internal"
        onClick={onClick}
        ariaLabel="open GB-123 integration"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'open GB-123 integration' }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(studioListener).not.toHaveBeenCalled();
    expect(container.querySelector('.lucide-arrow-right')).not.toBeNull();
    window.removeEventListener('goodboy:open-linear-studio', studioListener);
  });
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
