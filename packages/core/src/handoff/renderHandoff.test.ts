import { describe, expect, it } from 'vitest';
import type { ProviderId } from '@goodboy/types';
import { composeHandoffBody, hasSeparateSystemPrompt, renderHandoff } from './renderHandoff';
import { renderCurrentPlan } from './renderCurrentPlan';

const layers = ({ provider }: { readonly provider: ProviderId }) => ({
  provider,
  message: 'Move rounding from post_line to settle_batch.',
  contextPreamble: '## shared context',
  childRouting: '',
  clusterBoundary: null,
  currentPlan: '',
  goalAttachments: '',
  priorTurns: '',
  verbosity: 'Output verbosity: NORMAL.',
  guards: '[projects-scope]\nWrites ledger-core.\n[/projects-scope]',
  roleInstructions: 'you are an implementation agent.',
});

describe('renderHandoff', () => {
  it('puts the current plan between the shared context and the message', () => {
    const body = composeHandoffBody({
      ...layers({ provider: 'anthropic' }),
      currentPlan: '[current-plan id="p1"]\nbody\n[/current-plan]',
    });

    expect(body).toBe(
      'Output verbosity: NORMAL.\n\n## shared context\n\n[current-plan id="p1"]\nbody\n[/current-plan]\n\nMove rounding from post_line to settle_batch.',
    );
  });

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

describe('renderCurrentPlan', () => {
  it('names the plan and its revision, carries the whole body and says to rewrite it whole', () => {
    const text = renderCurrentPlan({
      id: 'plan-1',
      revision: 3,
      bodyMd: '# Backfill the batches\n\n## Goal\nDone.\n',
    });

    expect(text.startsWith('[current-plan id="plan-1" revision="3"]')).toBe(true);
    expect(text).toContain('# Backfill the batches\n\n## Goal\nDone.\n[/current-plan]');
    expect(text).toContain('write the whole updated plan as one plan block, never a patch');
  });

  it('leaves the revision out when it is not known', () => {
    expect(renderCurrentPlan({ id: 'plan-1', revision: null, bodyMd: 'body' })).toContain(
      '[current-plan id="plan-1"]',
    );
  });
});
