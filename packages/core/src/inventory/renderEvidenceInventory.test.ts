import { describe, expect, it } from 'vitest';
import { renderEvidenceInventory } from './renderEvidenceInventory';

describe('renderEvidenceInventory', () => {
  it('says nothing more exists only when nothing is listed and nothing is omitted', () => {
    const rendered = renderEvidenceInventory({
      inventory: { agentId: 'agent-1', revision: 'r1', entries: [], omittedCount: 0 },
    });

    expect(rendered).toContain('there is nothing more to ask for');
  });

  it('keeps omitted sources visible when none are listed', () => {
    const rendered = renderEvidenceInventory({
      inventory: { agentId: 'agent-1', revision: 'r1', entries: [], omittedCount: 3 },
    });

    expect(rendered).not.toContain('there is nothing more to ask for');
    expect(rendered).toContain('3 further source(s) exist and are not listed here');
  });
});
