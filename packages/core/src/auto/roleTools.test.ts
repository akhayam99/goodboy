import { describe, expect, it } from 'vitest';
import { parseChildClosing } from './closing';
import { buildAutoSystemPrompt } from './prompt';
import { buildDelegationResult, renderDelegationResult, type BuildResultParams } from './result';
import {
  AUTO_COMMAND_ROLES,
  canAutoRoleRunCommands,
  doesTaskNeedCommands,
  isMissingShellText,
  roleCannotRunCommandsMessage,
} from './roleTools';
import { AUTO_DELEGATION_ROLES } from './roles';

describe('canAutoRoleRunCommands', () => {
  it('gives a shell to the writer roles only', () => {
    const withShell = AUTO_DELEGATION_ROLES.filter((role) => canAutoRoleRunCommands({ role }));
    expect(withShell).toEqual([...AUTO_COMMAND_ROLES]);
    expect(canAutoRoleRunCommands({ role: 'investigator' })).toBe(false);
    expect(canAutoRoleRunCommands({ role: 'scout' })).toBe(false);
    expect(canAutoRoleRunCommands({ role: 'implementer' })).toBe(true);
  });
});

describe('doesTaskNeedCommands', () => {
  it.each([
    'Run git log on the branch and git ls-remote on origin to compare them.',
    'Check what ls-remote returns for ledger-core.',
    'Execute the test script for notify-relay.',
    'Run pnpm test in the mount.',
  ])('flags a task that runs commands: %s', (text) => {
    expect(doesTaskNeedCommands({ text })).toBe(true);
  });

  it.each([
    'Find where the retry limit is set in payments-api.',
    'Explain why the checkout total is wrong.',
    '',
  ])('leaves a task that only reads: %s', (text) => {
    expect(doesTaskNeedCommands({ text })).toBe(false);
  });
});

describe('isMissingShellText', () => {
  it('reads the words a child uses when it has no shell', () => {
    expect(
      isMissingShellText({
        text: 'Check incomplete: no shell tool in this session, so neither git command ran.',
      }),
    ).toBe(true);
    expect(isMissingShellText({ text: 'I do not have a shell here.' })).toBe(true);
    expect(isMissingShellText({ text: 'The mount is missing, so I stopped.' })).toBe(false);
  });
});

describe('roleCannotRunCommandsMessage', () => {
  it('names the roles that can run commands', () => {
    const message = roleCannotRunCommandsMessage({ role: 'investigator' });
    expect(message).toContain('investigator has no shell');
    expect(message).toContain('implementer');
    expect(message).not.toContain('scout,');
  });
});

describe('the Auto prompt', () => {
  it('tells each role line whether it has a shell and states the routing rule', () => {
    const prompt = buildAutoSystemPrompt({ isDelegationEnabled: true });
    expect(prompt).toContain('It has no shell and cannot run git, tests or any command.');
    expect(prompt).toContain('It has a shell.');
    expect(prompt).toContain('goes only to a role that has a shell');
  });
});

const ID = 'agent-investigator-1';

const blockedBy = (summary: string): BuildResultParams => ({
  delegationId: 'delegation-1',
  attemptId: 'attempt-1',
  treeId: 'tree-1',
  generation: 1,
  childAgentId: ID,
  role: 'investigator',
  routing: { provider: 'anthropic', model: 'sonnet', effort: 'high', reason: 'a diagnosis' },
  exit: 'ok',
  isTimedOut: false,
  turns: 1,
  durationMs: 9_000,
  closing: parseChildClosing({
    text: `${summary}\n<<step-done id="${ID}" status="blocked">>`,
    childAgentId: ID,
  }),
  summary: null,
  summarySource: 'child',
  changedFiles: [],
  checks: [],
  artifacts: [],
  artifactPersistence: 'not_applicable',
  isArtifactExpected: false,
  openQuestions: [],
  costUsd: 0.1,
});

describe('a child blocked for a missing shell', () => {
  it('ends blocked with missing_tool and tells Auto to reroute once', () => {
    const result = buildDelegationResult(
      blockedBy('Check incomplete: no shell tool in this session, so neither git command ran.'),
    );
    expect(result.outcome).toBe('blocked');
    expect(result.reason).toBe('missing_tool');
    const text = renderDelegationResult({ result });
    expect(text).toContain('hand the same task once to a role that can run commands');
    expect(text).not.toContain('investigator)');
  });

  it('keeps declared_blocked and no hint for any other block', () => {
    const result = buildDelegationResult(blockedBy('The mount holds no ledger-core checkout.'));
    expect(result.reason).toBe('declared_blocked');
    expect(renderDelegationResult({ result })).not.toContain('hand the same task once');
  });
});
