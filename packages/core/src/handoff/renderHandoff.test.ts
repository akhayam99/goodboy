import { describe, expect, it } from 'vitest';
import type { ProviderName } from '@goodboy/types';
import { composeHandoffBody, hasSeparateSystemPrompt, renderHandoff } from './renderHandoff';

const layers = ({ provider }: { readonly provider: ProviderName }) => ({
  provider,
  message: 'Move rounding from post_line to settle_batch.',
  contextPreamble: '## shared context',
  childRouting: '',
  clusterBoundary: null,
  goalAttachments: '',
  priorTurns: '',
  verbosity: 'Output verbosity: NORMAL.',
  guards: '[projects-scope]\nWrites ledger-core.\n[/projects-scope]',
  roleInstructions: 'you are an implementation agent.',
});

describe('renderHandoff', () => {
  it('puts scope, profile and role in the system prompt for Claude', () => {
    const rendered = renderHandoff(layers({ provider: 'anthropic' }));

    expect(rendered.system).toBe(
      '[projects-scope]\nWrites ledger-core.\n[/projects-scope]\n\nyou are an implementation agent.',
    );
    expect(rendered.message).toBe(
      'Output verbosity: NORMAL.\n\n## shared context\n\nMove rounding from post_line to settle_batch.',
    );
  });

  it('puts the same sections first in the message for every other provider', () => {
    const claude = renderHandoff(layers({ provider: 'anthropic' }));
    const codex = renderHandoff(layers({ provider: 'codex' }));

    expect(codex.body).toBe(claude.body);
    expect(codex.system).toBe(claude.system);
    expect(codex.message).toBe(
      `[projects-scope]\nWrites ledger-core.\n[/projects-scope]\n\n[role-boundary]\nyou are an implementation agent.\n[/role-boundary]\n\n${claude.body}`,
    );
    expect(hasSeparateSystemPrompt({ provider: 'codex' })).toBe(false);
    expect(hasSeparateSystemPrompt({ provider: 'anthropic' })).toBe(true);
  });

  it('skips the role boundary when the role has no instructions', () => {
    const rendered = renderHandoff({ ...layers({ provider: 'gemini' }), roleInstructions: '' });

    expect(rendered.system).toBe('[projects-scope]\nWrites ledger-core.\n[/projects-scope]');
    expect(rendered.message.startsWith('[projects-scope]')).toBe(true);
    expect(rendered.message).not.toContain('[role-boundary]');
  });

  it('stacks every layer in the order the CLI has always received them', () => {
    const body = composeHandoffBody({
      ...layers({ provider: 'codex' }),
      childRouting: 'routing',
      clusterBoundary: { marker: '<<cluster-done id="a1">>', block: 'cluster boundary' },
      goalAttachments: 'attachments',
      priorTurns: 'prior turns',
    });

    expect(body).toBe(
      [
        'Output verbosity: NORMAL.',
        'prior turns',
        'attachments',
        'cluster boundary',
        'routing',
        '## shared context',
        'Move rounding from post_line to settle_batch.',
      ].join('\n\n'),
    );
  });

  it('adds the cluster boundary only once', () => {
    const body = composeHandoffBody({
      ...layers({ provider: 'anthropic' }),
      message: 'Emit <<cluster-done id="a1">> when done.',
      clusterBoundary: { marker: '<<cluster-done id="a1">>', block: 'cluster boundary' },
    });

    expect(body).not.toContain('cluster boundary');
  });
});
