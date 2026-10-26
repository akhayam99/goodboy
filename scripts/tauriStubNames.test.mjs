import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { objectEntries, stubCommandNames } from './tauriStubNames.mjs';

const names = ({ source }) => [...stubCommandNames({ source })].sort();

describe('objectEntries', () => {
  it('reads properties, quoted keys and methods, and skips spreads', () => {
    const text = "{ a: 1, 'b-c': () => ({ nested: 1 }), d(args) { return 2; }, ...rest, e }";
    assert.deepEqual(
      objectEntries({ text, open: 0 }).map((entry) => entry.key),
      ['a', 'b-c', 'd'],
    );
  });

  it('ignores commas inside nested calls, arrays and strings', () => {
    const text = "{ a: f(1, 2), b: [1, 2], c: 'x, y: z', d: 4 }";
    assert.deepEqual(
      objectEntries({ text, open: 0 }).map((entry) => entry.key),
      ['a', 'b', 'c', 'd'],
    );
  });
});

describe('stubCommandNames', () => {
  it('reads the keys handed to stubStoryInvoke', () => {
    const source = `stubStoryInvoke({
      worktree_status: () => status,
      git_push_with_lease: (args: unknown) => { pushes.push(args); return { kind: 'pushed' }; },
      ...other,
    });`;
    assert.deepEqual(names({ source }), ['git_push_with_lease', 'worktree_status']);
  });

  it('reads only the handlers of createInvokeRouter and createInvokeMock', () => {
    const source = [
      'createInvokeRouter({ handlers: { agent_list: [], skill_read: () => 1 }, unknownResult: null });',
      'createInvokeMock({ unknownResult: null });',
      'const mock = createInvokeMock({ handlers: storyInvokeHandlers });',
    ].join('\n');
    assert.deepEqual(names({ source }), ['agent_list', 'skill_read']);
  });

  it('reads the table of story handlers', () => {
    const source = `const storyInvokeHandlers = {
      gh_status: () => ({ isAuthenticated: false }),
      repo_base_divergence: { ahead: 0 },
    } satisfies InvokeHandlers;`;
    assert.deepEqual(names({ source }), ['gh_status', 'repo_base_divergence']);
  });

  it('does not take a call on a member or a similar name', () => {
    const source = 'harness.stubStoryInvoke({ nope: 1 });\nmyStubStoryInvoke({ nope: 2 });';
    assert.deepEqual(names({ source }), []);
  });

  it('finds a renamed command name as a stub the registry can reject', () => {
    const registered = new Set(['git_push_with_lease']);
    const stubbed = stubCommandNames({
      source: 'stubStoryInvoke({ history_push_lease: () => 1 });',
    });
    assert.deepEqual(
      [...stubbed].filter((name) => !registered.has(name)),
      ['history_push_lease'],
    );
  });
});
