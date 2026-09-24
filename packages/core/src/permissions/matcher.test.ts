import { describe, expect, it } from 'vitest';
import { compiledToolMatcher, formatToolPattern, parseToolPattern } from './matcher';
import type { PermissionRulePattern } from '@goodboy/types';

describe('parseToolPattern', () => {
  it('bare tool name matches any args', () => {
    const m = parseToolPattern({ pattern: 'Edit' });
    expect(m.matches({ toolName: 'Edit', input: { file_path: '/any/path' } })).toBe(true);
    expect(m.matches({ toolName: 'Edit', input: {} })).toBe(true);
    expect(m.matches({ toolName: 'Bash', input: {} })).toBe(false);
  });

  it('wildcard * matches any tool and args', () => {
    const m = parseToolPattern({ pattern: '*' });
    expect(m.matches({ toolName: 'Edit', input: {} })).toBe(true);
    expect(m.matches({ toolName: 'Bash', input: { command: 'ls' } })).toBe(true);
    expect(m.matches({ toolName: 'AnythingElse', input: null })).toBe(true);
  });

  it('Bash(git:*) matches command with git: prefix (claude colon notation)', () => {
    const m = parseToolPattern({ pattern: 'Bash(git:*)' });
    expect(m.matches({ toolName: 'Bash', input: { command: 'git:status' } })).toBe(true);
    expect(m.matches({ toolName: 'Bash', input: { command: 'git:commit' } })).toBe(true);
    expect(m.matches({ toolName: 'Bash', input: { command: 'ls -la' } })).toBe(false);
    expect(m.matches({ toolName: 'Edit', input: { command: 'git:status' } })).toBe(false);
  });

  it('Bash(git *) matches space-separated git commands', () => {
    const m = parseToolPattern({ pattern: 'Bash(git *)' });
    expect(m.matches({ toolName: 'Bash', input: { command: 'git status' } })).toBe(true);
    expect(m.matches({ toolName: 'Bash', input: { command: 'git commit' } })).toBe(true);
    expect(m.matches({ toolName: 'Bash', input: { command: 'ls -la' } })).toBe(false);
  });

  it('Edit(/abs/**) matches file_path under /abs/', () => {
    const m = parseToolPattern({ pattern: 'Edit(/abs/**)' });
    expect(m.matches({ toolName: 'Edit', input: { file_path: '/abs/foo/bar' } })).toBe(true);
    expect(m.matches({ toolName: 'Edit', input: { file_path: '/abs/' } })).toBe(true);
    expect(m.matches({ toolName: 'Edit', input: { file_path: '/other/foo' } })).toBe(false);
  });

  it('single segment * does not cross : or /', () => {
    const m = parseToolPattern({ pattern: 'Bash(git *)' });
    expect(m.matches({ toolName: 'Bash', input: { command: 'git status' } })).toBe(true);
    const m2 = parseToolPattern({ pattern: 'Bash(git:*)' });
    expect(m2.matches({ toolName: 'Bash', input: { command: 'git:foo:bar' } })).toBe(false);
  });

  it('regex metachar escape: literal dot in path', () => {
    const m = parseToolPattern({ pattern: 'Edit(/foo.bar/*)' });
    expect(m.matches({ toolName: 'Edit', input: { file_path: '/foo.bar/baz' } })).toBe(true);
    expect(m.matches({ toolName: 'Edit', input: { file_path: '/fooXbar/baz' } })).toBe(false);
  });

  it('** glob matches across segments', () => {
    const m = parseToolPattern({ pattern: 'Edit(/src/**)' });
    expect(m.matches({ toolName: 'Edit', input: { file_path: '/src/a/b/c/d.ts' } })).toBe(true);
  });
});

describe('formatToolPattern round-trip', () => {
  it('bare tool', () => {
    const p: PermissionRulePattern = { tool: 'Edit' };
    expect(formatToolPattern({ pattern: p })).toBe('Edit');
  });

  it('tool with argsMatcher', () => {
    const p: PermissionRulePattern = { tool: 'Bash', argsMatcher: 'git:*' };
    expect(formatToolPattern({ pattern: p })).toBe('Bash(git:*)');
  });

  it('wildcard', () => {
    const p: PermissionRulePattern = { tool: '*' };
    expect(formatToolPattern({ pattern: p })).toBe('*');
  });
});

describe('compiledToolMatcher', () => {
  it('compiles each formatted pattern once', () => {
    const first = compiledToolMatcher({ pattern: { tool: 'Bash', argsMatcher: 'git *' } });
    const second = compiledToolMatcher({ pattern: { tool: 'Bash', argsMatcher: 'git *' } });
    expect(second).toBe(first);
    expect(compiledToolMatcher({ pattern: { tool: 'Bash', argsMatcher: 'ls *' } })).not.toBe(first);
  });

  it('matches like a freshly parsed pattern', () => {
    const matcher = compiledToolMatcher({ pattern: { tool: 'Edit', argsMatcher: '/src/**' } });
    expect(matcher.matches({ toolName: 'Edit', input: { file_path: '/src/a/b.ts' } })).toBe(true);
    expect(matcher.matches({ toolName: 'Edit', input: { file_path: '/lib/a.ts' } })).toBe(false);
  });
});
