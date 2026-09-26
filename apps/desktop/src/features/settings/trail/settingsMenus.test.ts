import { describe, expect, it, vi } from 'vitest';
import { settingsTrail } from './settingsMenus';

describe('settingsTrail', () => {
  it('offers no reset action, since Settings has no project scope to reset', () => {
    const segments = settingsTrail({
      scope: 'app',
      appSection: 'general',
      workspaceName: 'Harborline',
      onSelect: vi.fn(),
    });

    expect(segments.map((segment) => segment.id)).toEqual(['settings', 'scope', 'section']);
    expect(segments.flatMap((segment) => segment.menu?.actions ?? [])).toEqual([]);
    expect(
      segments
        .find((segment) => segment.id === 'scope')
        ?.menu?.groups.flatMap((group) => group.rows.map((row) => row.id)),
    ).toEqual(['app', 'workspace', 'providers', 'tools']);
  });
});
