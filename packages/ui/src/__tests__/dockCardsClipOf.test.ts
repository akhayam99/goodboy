import { describe, expect, it } from 'vitest';
import { dockCardsClipOf } from '../dockCardsClipOf';
import type { DockDropZone, DockRect } from '../dockDropZonesOf';

type ZoneParams = {
  readonly id: string;
  readonly layer: number;
  readonly card: DockRect;
};

const zoneOf = ({ id, layer, card }: ZoneParams): DockDropZone => ({
  id,
  target: { at: 'page' },
  paneKey: null,
  placement: 'left',
  scope: 'dock',
  layer,
  rect: card,
  card,
  anchor: { x: card.x, y: card.y, align: 'center' },
  label: 'Place left',
  layout: { columns: [], groups: {} },
  swap: null,
});

const overlaps = (a: DockRect, b: DockRect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('cards that would overlap', () => {
  it('trims a band card where an edge card of the dock covers its end', () => {
    const band = zoneOf({ id: 'above', layer: 1, card: { x: 0, y: 8, width: 400, height: 40 } });
    const edge = zoneOf({
      id: 'dock-right',
      layer: 3,
      card: { x: 300, y: 0, width: 96, height: 600 },
    });

    const [kept, edgeKept] = dockCardsClipOf({ zones: [band, edge] });

    expect(edgeKept?.card).toEqual(edge.card);
    expect(kept?.card.x).toBe(0);
    expect(kept?.card.width).toBe(300);
  });

  it('drops a card that an edge card covers and cannot be trimmed', () => {
    const side = zoneOf({
      id: 'after',
      layer: 2,
      card: { x: 296, y: 100, width: 100, height: 200 },
    });
    const edge = zoneOf({
      id: 'dock-right',
      layer: 3,
      card: { x: 300, y: 0, width: 96, height: 600 },
    });

    const zones = dockCardsClipOf({ zones: [side, edge] });

    expect(zones.map((zone) => zone.id)).toEqual(['dock-right']);
  });

  it('leaves cards that do not overlap as they are', () => {
    const a = zoneOf({ id: 'a', layer: 1, card: { x: 0, y: 0, width: 100, height: 40 } });
    const b = zoneOf({ id: 'b', layer: 1, card: { x: 0, y: 60, width: 100, height: 40 } });

    const zones = dockCardsClipOf({ zones: [a, b] });

    expect(zones.map((zone) => zone.card)).toEqual([a.card, b.card]);
    expect(overlaps(a.card, b.card)).toBe(false);
  });
});
