import { describe, expect, it } from 'vitest';
import { parseChildClosing } from './closing';
import { buildAutoSystemPrompt } from './prompt';
import { buildDelegationResult, renderDelegationResult, type BuildResultParams } from './result';
import {
  AUTO_COMMAND_ROLES,
  canAutoRoleRunCommands,
  commandMentionOf,
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

describe('commandMentionOf', () => {
  it.each([
    'Run git log on the branch and git ls-remote on origin to compare them.',
    'Check what ls-remote returns for ledger-core.',
    'Execute the test script for notify-relay.',
    'Run pnpm test in the mount.',
    'Check each commit in `a1b2c3d4e..HEAD`: does its subject match its diff?',
    'Compare origin/main...HEAD and list the commits that revert each other.',
  ])('flags a task that runs commands: %s', (text) => {
    expect(commandMentionOf({ text })).not.toBeNull();
  });

  it.each([
    'Find where the retry limit is set in payments-api.',
    'Explain why the checkout total is wrong.',
    'Compare the versions 1.2.0...1.4.0 of the changelog of notify-relay.',
    'Wait... then read the file; deadbeef is not a commit here.',
    '',
  ])('leaves a task that only reads: %s', (text) => {
    expect(commandMentionOf({ text })).toBeNull();
  });
});

describe('a command named inside a prohibition', () => {
  it.each([
    'Read the plan files. No yarn install (no node_modules in this folder).',
    'Never run git push from here.',
    'Do not commit anything and do not run git commit.',
    "Don't run pnpm test, only read the files.",
    'Work without running npm install.',
    'No yarn install, git push or pnpm test.',
    'Leggi i file. Senza eseguire yarn install.',
    'Non lanciare git push.',
    'Do not run the tests.',
  ])('is not a command to run: %s', (text) => {
    expect(commandMentionOf({ text })).toBeNull();
  });

  it.each([
    ['Run pnpm test in the mount.', 'Run pnpm test'],
    ['No yarn install. Run pnpm test.', 'Run pnpm test'],
    ['Do not run git log, run pnpm test.', 'pnpm test'],
    ['No yarn install, run git status.', 'git status'],
    ['Never push by hand but then git push the branch.', 'git push'],
    ['No node_modules here.\nThen run cargo build.', 'run cargo build'],
  ])('still counts the command that is asked for: %s', (text, match) => {
    expect(commandMentionOf({ text })).not.toBeNull();
    expect(commandMentionOf({ text })).toBe(match);
  });

  it('names the first command that is asked for', () => {
    expect(commandMentionOf({ text: 'No yarn install. Check git log and pnpm test.' })).toBe(
      'git log',
    );
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

  it('is unchanged when no phrase matched', () => {
    expect(roleCannotRunCommandsMessage({ role: 'planner' })).toBe(
      roleCannotRunCommandsMessage({ role: 'planner', match: null }),
    );
    expect(roleCannotRunCommandsMessage({ role: 'planner' })).not.toContain('matched');
  });

  it('quotes the exact phrase that matched so the brief can be fixed in one try', () => {
    const text = 'Plan the export. Run pnpm test before you write it.';
    const message = roleCannotRunCommandsMessage({
      role: 'planner',
      match: commandMentionOf({ text }),
    });
    expect(message).toContain('The task matched: `Run pnpm test`.');
    expect(message).toContain('Reword or drop that phrase');
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
