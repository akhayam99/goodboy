import { describe, expect, it } from 'vitest';
import { dockGridTracksOf } from '../dockGridTracksOf';

describe('the rows of a stacked column', () => {
  it('keeps 160px for each panel under its weight', () => {
    const { rows } = dockGridTracksOf({
      columns: [
        {
          width: 400,
          dragMax: 600,
          panes: [
            { key: 'terminal', weight: 800 },
            { key: 'browser', weight: 200 },
          ],
        },
      ],
    });

    expect(rows).toBe('minmax(160px,800fr) 12px minmax(160px,200fr)');
  });
});
