import { describe, expect, it } from 'vitest';
import { parseDelegateSpec } from './delegateSpec';

const spec = (value: unknown): string => JSON.stringify(value);

describe('parsing the spec of an agent delegate call', () => {
  it('reads a children list and hashes it the same way every time', () => {
    const text = spec({
      children: [
        { role: 'scout', task: 'find the ledger-core exports', reason: 'read only search' },
      ],
    });
    const first = parseDelegateSpec({ text });
    const second = parseDelegateSpec({ text });
    expect(first.kind).toBe('ok');
    expect(first).toEqual(second);
  });

  it('accepts a bare list and gives the same hash as the wrapped form', () => {
    const child = { role: 'planner', task: 'plan the rollout', reason: 'needs a plan first' };
    const wrapped = parseDelegateSpec({ text: spec({ children: [child] }) });
    const bare = parseDelegateSpec({ text: spec([child]) });
    expect(bare).toEqual(wrapped);
  });

  it('refuses a role outside the closed set before anything is normalized', () => {
    const outcome = parseDelegateSpec({
      text: spec({ children: [{ role: 'debugger', task: 'x', reason: 'y' }] }),
    });
    expect(outcome).toMatchObject({ kind: 'refused', code: 'role_unknown' });
  });

  it('refuses the Generalist and custom roles', () => {
    for (const role of ['custom', 'generic', 'auto', 'report', 'wireframe', 'resolver']) {
      const outcome = parseDelegateSpec({
        text: spec({ children: [{ role, task: 'x', reason: 'y' }] }),
      });
      expect(outcome).toMatchObject({ kind: 'refused', code: 'role_unknown' });
    }
  });

  it('needs a role, a task and a reason on a new piece of work', () => {
    const noRole = parseDelegateSpec({ text: spec([{ task: 'x', reason: 'y' }]) });
    const noTask = parseDelegateSpec({ text: spec([{ role: 'scout', reason: 'y' }]) });
    const noReason = parseDelegateSpec({ text: spec([{ role: 'scout', task: 'x' }]) });
    expect(noRole).toMatchObject({ kind: 'refused', code: 'spec_invalid' });
    expect(noTask).toMatchObject({ kind: 'refused', code: 'spec_invalid' });
    expect(noReason).toMatchObject({ kind: 'refused', code: 'spec_invalid' });
  });

  it('lets a revise leave out the role and the task', () => {
    const outcome = parseDelegateSpec({
      text: spec([
        {
          reason: 'the user asked for a change',
          revises: { artifactId: 'artifact-plan', expectedRevision: 2 },
          changeFrom: ['outbox-user-1'],
        },
      ]),
    });
    expect(outcome).toMatchObject({
      kind: 'ok',
      children: [
        {
          role: null,
          revises: { artifactId: 'artifact-plan', expectedRevision: 2 },
          changeFrom: ['outbox-user-1'],
        },
      ],
    });
  });

  it('refuses a revise without a positive whole revision', () => {
    for (const expectedRevision of [0, 1.5, '2', null]) {
      const outcome = parseDelegateSpec({
        text: spec([{ reason: 'r', revises: { artifactId: 'artifact-plan', expectedRevision } }]),
      });
      expect(outcome).toMatchObject({ kind: 'refused', code: 'spec_invalid' });
    }
  });

  it('refuses text that is not json or has no children list', () => {
    expect(parseDelegateSpec({ text: 'not json' })).toMatchObject({
      kind: 'refused',
      code: 'spec_invalid',
    });
    expect(parseDelegateSpec({ text: spec({ nope: [] }) })).toMatchObject({
      kind: 'refused',
      code: 'spec_invalid',
    });
  });

  it('reports every bad child with its slot', () => {
    const outcome = parseDelegateSpec({
      text: spec([
        { role: 'scout', task: 'ok', reason: 'ok' },
        { role: 'nope', task: 'x', reason: 'y' },
        'text',
      ]),
    });
    expect(outcome).toMatchObject({
      kind: 'refused',
      perChild: [
        { slot: 1, code: 'role_unknown' },
        { slot: 2, code: 'spec_invalid' },
      ],
    });
  });

  it('caps long text and de-duplicates artifact ids', () => {
    const outcome = parseDelegateSpec({
      text: spec([
        {
          role: 'implementer',
          task: 'x'.repeat(20_000),
          reason: 'r'.repeat(900),
          artifacts: ['a', 'a', ' b ', '', 7],
          mount: 'mount-harborline',
        },
      ]),
    });
    expect(outcome.kind).toBe('ok');
    if (outcome.kind !== 'ok') {
      return;
    }
    const child = outcome.children[0];
    expect(child?.task.length).toBe(8_000);
    expect(child?.reason.length).toBe(240);
    expect(child?.artifactIds).toEqual(['a', 'b']);
    expect(child?.mount).toBe('mount-harborline');
  });

  it('changes the hash when any field changes', () => {
    const base = { role: 'scout', task: 'look', reason: 'why' };
    const one = parseDelegateSpec({ text: spec([base]) });
    const two = parseDelegateSpec({ text: spec([{ ...base, task: 'look again' }]) });
    expect(one.kind === 'ok' && two.kind === 'ok' && one.hash !== two.hash).toBe(true);
  });

  it('reads a retry that names an earlier delegation and a reason only', () => {
    const outcome = parseDelegateSpec({
      text: spec([
        { retryOf: 'delegation-scout-1', reason: 'the mount is free now', model: 'sonnet' },
      ]),
    });
    expect(outcome).toMatchObject({
      kind: 'ok',
      children: [{ retryOf: 'delegation-scout-1', role: null, task: '', model: 'sonnet' }],
    });
  });

  it('refuses a retry that also sets what the earlier work already fixed', () => {
    for (const extra of [{ role: 'scout' }, { task: 'new task' }, { mount: 'mount-harborline' }]) {
      const outcome = parseDelegateSpec({
        text: spec([{ retryOf: 'delegation-scout-1', reason: 'again', ...extra }]),
      });
      expect(outcome).toMatchObject({ kind: 'refused', code: 'spec_invalid' });
    }
  });

  it('needs a reason on a retry and hashes it apart from the work it repeats', () => {
    const noReason = parseDelegateSpec({ text: spec([{ retryOf: 'delegation-scout-1' }]) });
    expect(noReason).toMatchObject({ kind: 'refused', code: 'spec_invalid' });
    const one = parseDelegateSpec({ text: spec([{ retryOf: 'delegation-a', reason: 'r' }]) });
    const two = parseDelegateSpec({ text: spec([{ retryOf: 'delegation-b', reason: 'r' }]) });
    expect(one.kind === 'ok' && two.kind === 'ok' && one.hash !== two.hash).toBe(true);
  });
});
