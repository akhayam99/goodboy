// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { screenLabel } from './screenLabel';

const SESSION_ID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';

describe('screenLabel', () => {
  it.each([
    ['board', 'Board'],
    ['new', 'New session'],
    [`s/${SESSION_ID}`, 'Session'],
    [`s/${SESSION_ID}/review`, 'Session › Comments'],
    [`s/${SESSION_ID}/review/t/thread-9`, 'Session › Comments'],
    [`s/${SESSION_ID}/branch/pr`, 'Session › Branch › Pull request'],
    [`s/${SESSION_ID}/branch/comments`, 'Session › Branch › Comments'],
    [
      `s/${SESSION_ID}/branch/files:/Users/rowan/harborline@commit:fc2f0899#src/App.tsx`,
      'Session › Branch › Files',
    ],
    [`s/${SESSION_ID}/context/goal`, 'Session › Context › Goal'],
    [`s/${SESSION_ID}/workflows/run-42/edit`, 'Session › Runs › Workflow editor'],
    [`s/${SESSION_ID}/pr/mr`, 'Session › Pull request › Merge request'],
    [`s/${SESSION_ID}/agents/agent/agent-7`, 'Session › Agents'],
    ['board+settings/providers/anthropic', 'Board · Settings › Providers'],
    ['board+inbox/linear/NW-142', 'Board · Tasks › Linear'],
    [`s/${SESSION_ID}/diff+changelog`, "Session › Files · What's new"],
  ])('reads %s as %s', (key, expected) => {
    expect(screenLabel({ locationKey: key })).toBe(expected);
  });

  it('never carries an id, a path or a record key', () => {
    const label = screenLabel({
      locationKey: `s/${SESSION_ID}/diff//Users/rowan/harborline@commit:fc2f0899#src/App.tsx+inbox/github/acme/ledger-core#12`,
    });
    expect(label).toBe('Session › Files · Tasks › GitHub');
    expect(label).not.toContain(SESSION_ID);
    expect(label).not.toContain('rowan');
    expect(label).not.toContain('harborline');
    expect(label).not.toContain('ledger-core');
  });

  it('ignores a plus sign inside a path that is not a studio', () => {
    expect(screenLabel({ locationKey: `s/${SESSION_ID}/diff/c++/main.cc` })).toBe(
      'Session › Files',
    );
  });

  it('says unknown for a key it cannot read', () => {
    expect(screenLabel({ locationKey: 'rowan@example.dev' })).toBe('Unknown');
  });
});
