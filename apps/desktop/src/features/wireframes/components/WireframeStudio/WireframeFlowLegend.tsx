import { FLOW_EDGE_GLYPH } from './WireframeFlowOverview';

const ENTRIES = [
  { key: 'next', glyph: '→', label: 'next' },
  { key: 'back', glyph: FLOW_EDGE_GLYPH.back, label: 'back' },
  { key: 'self', glyph: FLOW_EDGE_GLYPH.self, label: 'same screen' },
] as const;

export const WireframeFlowLegend = () => (
  <ul
    aria-label="Flow legend"
    data-testid="wireframe-flow-legend"
    className="flex min-w-0 flex-wrap items-center gap-x-3.5 gap-y-1 text-2xs text-muted-foreground"
  >
    {ENTRIES.map((entry) => (
      <li key={entry.key} className="inline-flex items-center gap-1.5">
        <span aria-hidden className="text-foreground">
          {entry.glyph}
        </span>
        {entry.label}
      </li>
    ))}
  </ul>
);
