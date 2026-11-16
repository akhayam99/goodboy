// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { TOOL_USES } from '../../../store/slices/integrations/toolUses';
import { TOOL_ORDER } from '../../integrations/toolOrder';
import { toolUseRowsOf } from './toolUseRowsOf';

describe('toolUseRowsOf', () => {
  it.each(TOOL_ORDER)('gives %s rows whose counts Tasks writes', (tool) => {
    const rows = toolUseRowsOf({ tool });

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      if (row.source.kind === 'tasks') {
        expect(TOOL_USES[tool]).toContain(row.source.use);
      }
    }
  });

  it('lists what GitHub does in the order of the plan', () => {
    expect(toolUseRowsOf({ tool: 'github' }).map((row) => row.label)).toEqual([
      'Pull requests',
      'Reviews waiting on you',
      'Issues in Tasks',
    ]);
  });

  it('reads the Slack channels from the binding, not from Tasks', () => {
    expect(toolUseRowsOf({ tool: 'slack' }).map((row) => row.source.kind)).toEqual([
      'channels',
      'tasks',
    ]);
  });
});
