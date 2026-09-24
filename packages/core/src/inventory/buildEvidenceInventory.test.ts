import { describe, expect, it } from 'vitest';
import { extractContextRead } from '../context/marker-parsing';
import { buildEvidenceInventory, type EvidenceInventoryInput } from './buildEvidenceInventory';
import { renderEvidenceInventory } from './renderEvidenceInventory';
import { planContextRead } from './resolveContextRead';

const task: EvidenceInventoryInput = {
  sourceId: 'task:agent-1',
  kind: 'task',
  label: 'restore the dropped guard',
  provenance: 'kickoff',
  revision: 'v1',
  availability: 'delivered',
};

const obligation: EvidenceInventoryInput = {
  sourceId: 'obligation:o-1',
  kind: 'obligation',
  label: 'implementer for repair',
  provenance: 'capability obligation',
  revision: 'v1',
  availability: 'retrievable',
  detail: 'owner agent-7, running, scope sendTurn.ts, expects the guard back with a test',
};

const inventoryOf = (inputs: ReadonlyArray<EvidenceInventoryInput>, omittedCount = 0) =>
  buildEvidenceInventory({ agentId: 'agent-1', inputs, omittedCount });

describe('evidence inventory', () => {
  it('lists a running obligation with its owner and expected result', () => {
    const inventory = inventoryOf([task, obligation]);
    const rendered = renderEvidenceInventory({ inventory });

    expect(inventory.entries.map((entry) => entry.sourceId)).toEqual([
      'task:agent-1',
      'obligation:o-1',
    ]);
    expect(rendered).toContain('`obligation:o-1`');
    expect(rendered).toContain('owner agent-7');
    expect(rendered).toContain('expects the guard back with a test');
  });

  it('separates nothing more from more on request', () => {
    expect(renderEvidenceInventory({ inventory: inventoryOf([task]) })).toContain(
      'nothing else exists beyond this list.',
    );
    expect(renderEvidenceInventory({ inventory: inventoryOf([task], 3) })).toContain(
      '3 further source(s) exist and are not listed here',
    );
    expect(renderEvidenceInventory({ inventory: inventoryOf([]) })).toContain(
      'there is nothing more to ask for.',
    );
  });

  it('moves the revision when an entry changes and holds it when nothing does', () => {
    const first = inventoryOf([task, obligation]);
    const same = inventoryOf([obligation, task]);
    const changed = inventoryOf([task, { ...obligation, revision: 'v2' }]);

    expect(same.revision).toBe(first.revision);
    expect(changed.revision).not.toBe(first.revision);
  });

  it('delivers an authorized source and refuses an unknown or unauthorized one', () => {
    const inventory = inventoryOf([task, obligation]);
    const extraction = extractContextRead({
      assistantText: `<<context-read>>{"v":1,"inventoryRevision":"${inventory.revision}","sources":[{"id":"task:agent-1"},{"id":"obligation:o-1"},{"id":"secret:1"}]}<</context-read>>`,
    });

    expect(extraction.kind).toBe('valid');
    const plan = planContextRead({
      inventory,
      request: extraction.kind === 'valid' ? extraction.request : null,
      authorizedSourceIds: new Set(['task:agent-1']),
    });

    expect(plan.kind).toBe('resolved');
    expect(plan.kind === 'resolved' ? plan.resolutions.map((entry) => entry.outcome) : []).toEqual([
      'delivered',
      'unauthorized',
      'unknown-source',
    ]);
  });

  it('refuses a read formed against a stale inventory revision', () => {
    const inventory = inventoryOf([task]);
    const extraction = extractContextRead({
      assistantText:
        '<<context-read>>{"v":1,"inventoryRevision":"rstale","sources":["task:agent-1"]}<</context-read>>',
    });

    const plan = planContextRead({
      inventory,
      request: extraction.kind === 'valid' ? extraction.request : null,
      authorizedSourceIds: new Set(['task:agent-1']),
    });

    expect(plan.kind).toBe('stale-revision');
  });

  it('reports a malformed read body without throwing', () => {
    expect(extractContextRead({ assistantText: '<<context-read>>{oops<</context-read>>' })).toEqual(
      {
        kind: 'malformed',
        reason: 'the context-read body is not valid json',
      },
    );
    expect(extractContextRead({ assistantText: 'nothing here' })).toEqual({ kind: 'none' });
  });
});
