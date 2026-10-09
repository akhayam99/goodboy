import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..', '..');

const CALLERS: ReadonlyArray<string> = [
  'features/chat/components/ChatInput/hooks/useComposerSuggestions/index.ts',
  'features/chat/components/HandoffChip/index.tsx',
  'features/explore/components/ExplorePane/ExploreSpawnPopover.tsx',
  'features/integrations/gitlab/MergeRequest/MrDetailPanel/CreateMrForm.tsx',
  'features/session/components/AgentDetailPane/AgentFollowUps.tsx',
  'features/workflows/components/WorkflowFollowToastBridge/index.tsx',
  'features/integrations/components/LaunchSessionPanel/index.tsx',
  'features/session/components/AgentTree/WorkflowRunStartButton.tsx',
  'features/resolve/hooks/useFixStartedToast/index.ts',
];

const sourceOf = (path: string): string => readFileSync(join(SRC, path), 'utf8');

const callsOf = (source: string): ReadonlyArray<string> =>
  Array.from(source.matchAll(/follow\w*\(\{[\s\S]*?\n\s*\}\);/g), (match) => match[0]);

describe('every start that offers Follow goes through useFollowToast', () => {
  it('has removed the old agent started hook', () => {
    expect(existsSync(join(SRC, 'shared/hooks/useAgentStartedToast'))).toBe(false);
  });

  it.each(CALLERS)('%s uses the shared hook with the default Follow label', (path) => {
    const source = sourceOf(path);

    expect(source).toContain("shared/hooks/useFollowToast'");
    expect(source).not.toContain('useAgentStartedToast');
    expect(source).not.toContain('actionLabel');
    expect(source).not.toContain('Open the agent');
    const calls = callsOf(source);
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call).toContain('startKey');
      expect(call).not.toMatch(/\blabel:/);
    }
  });
});
