// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { OverrideSettings, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { SETTING_HIDDEN_MODELS } from '../../../../../settings/settings';
import { ModelsGroup } from './index';

const WORKSPACE = 'ws-1' as WorkspaceId;

const OVERRIDES: OverrideSettings = {
  defaultProviderId: null,
  defaultBranchPrefix: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: { summarizer: { providerId: 'anthropic', model: 'claude-haiku-4-5' } },
  roleModels: {
    planner: { providerId: 'anthropic', model: 'claude-opus-5-5', effort: 'high' },
    scout: { providerId: 'cursor', model: 'claude-haiku-4-5', effort: 'low' },
  },
  parallelAgents: null,
  providerPool: null,
  attributionFooter: null,
  replyVoice: null,
  replyStyleNote: null,
  replyTemplateFixed: null,
  replyTemplateNoChange: null,
  resolveOnGithub: null,
  resolveCommitStyle: null,
  afterMerge: null,
  defaultBranchTemplate: null,
};

beforeEach(() => {
  useAppStore.setState({
    settings: {
      [SETTING_HIDDEN_MODELS]: '{}',
      'chat.default_model.ws-1': JSON.stringify({
        provider: 'anthropic',
        model: 'opus-5',
        effort: 'low',
      }),
    },
    workspaceOverrides: { [WORKSPACE]: OVERRIDES },
    loadSetting: async () => null,
  });
});

afterEach(() => {
  cleanup();
  useAppStore.setState({ settings: {}, workspaceOverrides: {} });
});

describe('ModelsGroup pinned count', () => {
  it('shows what this workspace pinned to the provider in the header', () => {
    render(<ModelsGroup providerId="anthropic" workspaceId={WORKSPACE} isFocused={false} />);

    expect(screen.getByText('3 pinned')).toBeDefined();
  });

  it('counts per provider, so another provider shows its own number', () => {
    render(<ModelsGroup providerId="cursor" workspaceId={WORKSPACE} isFocused={false} />);

    expect(screen.getByText('1 pinned')).toBeDefined();
  });

  it('shows no count for a provider with no pins or without a workspace', () => {
    const { rerender } = render(
      <ModelsGroup providerId="gemini" workspaceId={WORKSPACE} isFocused={false} />,
    );
    expect(screen.queryByText(/pinned$/)).toBeNull();

    rerender(<ModelsGroup providerId="anthropic" workspaceId={null} isFocused={false} />);
    expect(screen.queryByText(/pinned$/)).toBeNull();
  });
});
