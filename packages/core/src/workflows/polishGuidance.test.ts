import { describe, expect, it, vi } from 'vitest';
import type { GoalPolishDeps } from './polish';
import {
  GUIDANCE_POLISH_SYSTEM_PROMPT,
  parsePolishedGuidance,
  polishWorkflowGuidance,
} from './polishGuidance';

const ROUGH =
  'also at the end cluster the commits in an organized way.  dont run the integration tests ever\nopen PR as a draft, please';

const deps = (stdout: string, exitCode = 0): GoalPolishDeps => ({
  providerId: 'anthropic',
  model: 'sonnet-4.6',
  invokeFn: vi.fn().mockResolvedValue({ stdout, stderr: '', exitCode }),
});

describe('the guidance polish prompt', () => {
  it('keeps every rule on its own line, the language and the list, and adds nothing', () => {
    expect(GUIDANCE_POLISH_SYSTEM_PROMPT).toContain('Match the language of the input exactly.');
    expect(GUIDANCE_POLISH_SYSTEM_PROMPT).toContain(
      'Keep every rule the input states, and only those. Never add, merge, split into new meanings, or drop a rule.',
    );
    expect(GUIDANCE_POLISH_SYSTEM_PROMPT).toContain(
      'One rule per line, each line starting with "- ".',
    );
    expect(GUIDANCE_POLISH_SYSTEM_PROMPT).not.toContain('one to three sentences');
  });
});

describe('polishWorkflowGuidance', () => {
  it('sends the rough notes with its own prompt and keeps the polished list', async () => {
    const polished =
      '- Group the commits by concern at the end.\n- Never run the integration tests.\n- Open the PR as a draft.';
    const d = deps(JSON.stringify({ result: `<<guidance>>\n${polished}\n<</guidance>>` }));

    expect(await polishWorkflowGuidance(d, ROUGH)).toBe(polished);
    expect(d.invokeFn).toHaveBeenCalledWith(
      'summarize_session',
      expect.objectContaining({
        args: expect.objectContaining({
          systemPrompt: GUIDANCE_POLISH_SYSTEM_PROMPT,
          userMessage: expect.stringContaining('dont run the integration tests ever'),
        }),
      }),
    );
  });

  it('runs nothing for empty guidance and gives nothing back on a failed run', async () => {
    const empty = deps('');

    expect(await polishWorkflowGuidance(empty, '  \n ')).toBeNull();
    expect(empty.invokeFn).not.toHaveBeenCalled();
    expect(await polishWorkflowGuidance(deps('<<guidance>>- x<</guidance>>', 1), ROUGH)).toBeNull();
  });
});

describe('parsePolishedGuidance', () => {
  it('turns numbered or starred lines into one list line each and drops blank ones', () => {
    expect(
      parsePolishedGuidance(
        '<<guidance>>\n1. Open the PR as a draft.\n\n* Keep the diff small.\n<</guidance>>',
      ),
    ).toBe('- Open the PR as a draft.\n- Keep the diff small.');
  });

  it('refuses an answer without the marker block', () => {
    expect(parsePolishedGuidance('- Open the PR as a draft.')).toBeNull();
    expect(parsePolishedGuidance('<<guidance>>never closed')).toBeNull();
  });
});
