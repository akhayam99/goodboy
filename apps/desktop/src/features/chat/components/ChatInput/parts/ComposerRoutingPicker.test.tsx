// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock(),
);

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ComposerRoutingPicker, type ComposerRouting } from './ComposerRoutingPicker';

const routingOn = ({
  modelId,
  isOverridden = false,
}: {
  readonly modelId: string;
  readonly isOverridden?: boolean;
}): ComposerRouting => ({
  effectiveProvider: 'anthropic',
  effectiveModelId: modelId,
  effectiveEffort: 'medium',
  verbosity: 'normal',
  connectedProviderIds: ['anthropic'],
  allowOverride: true,
  isOverridden,
  referenceProvider: 'anthropic',
  referenceModel: 'claude-opus-5',
  setVerbosity: vi.fn(),
  onSelectRoute: vi.fn(),
  onResetTurnOverride: vi.fn(),
});

const trigger = (): HTMLElement => screen.getByRole('button', { name: /^Model routing:/ });

afterEach(() => {
  cleanup();
});

describe('the composer model chip', () => {
  it('names the model the next turn will use, never a bare Model word', () => {
    render(<ComposerRoutingPicker routing={routingOn({ modelId: 'claude-opus-5' })} />);

    expect(trigger().textContent).toContain('Opus 5');
    expect(trigger().textContent).not.toMatch(/^Model/);
    expect(trigger().textContent).not.toContain('Next turn');
    expect(trigger().querySelector('svg')).not.toBeNull();
  });

  it('shows no reset control while the next turn uses the reference model', () => {
    render(<ComposerRoutingPicker routing={routingOn({ modelId: 'claude-opus-5' })} />);

    expect(screen.queryByRole('button', { name: 'Reset routing override' })).toBeNull();
  });

  it('names the picked model and offers the reset when the turn is overridden', () => {
    render(
      <ComposerRoutingPicker
        routing={routingOn({ modelId: 'claude-sonnet-5', isOverridden: true })}
      />,
    );

    expect(trigger().textContent).toContain('Sonnet 5');
    screen.getByRole('button', { name: 'Reset routing override' });
  });
});
