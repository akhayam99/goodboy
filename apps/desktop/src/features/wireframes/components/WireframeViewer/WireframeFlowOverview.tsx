import { useMemo } from 'react';
import { cn } from '@goodboy/ui';
import type { WireframeDocument } from '@goodboy/core';
import type { WireframeIndex } from '../../wireframeIndex';
import {
  EDGE_PAINT,
  EDGE_ROLES,
  FLOW_EDGE_DASH,
  buildFlowLayout,
} from '../../flowLayout/buildFlowLayout';

type Props = {
  readonly document: WireframeDocument;
  readonly index: WireframeIndex;
  readonly currentScreenId: string;
  readonly onSelectScreen: (screenId: string) => void;
};

export const WireframeFlowOverview = ({
  document,
  index,
  currentScreenId,
  onSelectScreen,
}: Props) => {
  const layout = useMemo(() => buildFlowLayout({ document, index }), [document, index]);

  return (
    <div className="overflow-x-auto">
      <svg
        data-testid="wireframe-flow-overview"
        role="img"
        aria-label="Wireframe flow overview"
        viewBox={`${layout.left} ${layout.top} ${layout.width} ${layout.height}`}
        width={layout.width}
        height={layout.height}
        className="block"
      >
        <defs>
          {EDGE_ROLES.map((role) => (
            <marker
              key={role}
              id={`wireframe-flow-arrow-${role}`}
              markerUnits="userSpaceOnUse"
              markerWidth="8"
              markerHeight="8"
              refX="7.5"
              refY="4"
              orient="auto"
            >
              <path d="M0.5,0.5 L7.5,4 L0.5,7.5 Z" className={EDGE_PAINT[role].head} />
            </marker>
          ))}
        </defs>
        {layout.edges.map((edge) => (
          <path
            key={edge.key}
            d={edge.path}
            fill="none"
            className={EDGE_PAINT[edge.role].line}
            strokeWidth={edge.role === 'spine' ? 1.5 : 1.25}
            strokeLinecap="round"
            strokeDasharray={FLOW_EDGE_DASH[edge.kind]}
            markerEnd={`url(#wireframe-flow-arrow-${edge.role})`}
          />
        ))}
        {layout.boxes.map((box) => (
          <g
            key={box.screenId}
            role="button"
            tabIndex={0}
            aria-label={`Go to ${box.title}`}
            className="cursor-pointer"
            onClick={() => onSelectScreen(box.screenId)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                onSelectScreen(box.screenId);
              }
            }}
          >
            <rect
              x={box.x}
              y={box.y}
              width={box.width}
              height={box.height}
              rx="7"
              className={
                box.screenId === currentScreenId
                  ? 'fill-muted stroke-primary'
                  : 'fill-elevated stroke-border'
              }
              strokeWidth="1"
            />
            <text
              x={box.x + box.width / 2}
              y={box.y + box.height / 2 + 4}
              textAnchor="middle"
              className="fill-foreground text-meta"
            >
              {box.text}
              {box.text === box.title ? null : <title>{box.title}</title>}
            </text>
          </g>
        ))}
        {layout.edges.map((edge) =>
          edge.label === null ? null : (
            <g key={`${edge.key}-label`}>
              <rect
                x={edge.label.x}
                y={edge.label.y}
                width={edge.label.width}
                height={edge.label.height}
                rx="4"
                className={EDGE_PAINT[edge.role].plate}
                strokeWidth="1"
              />
              <text
                x={edge.label.x + edge.label.width / 2}
                y={edge.label.y + edge.label.height / 2 + 3.5}
                textAnchor="middle"
                className={cn('text-chip', EDGE_PAINT[edge.role].ink)}
              >
                {edge.label.glyph === null ? null : (
                  <tspan aria-hidden>{`${edge.label.glyph} `}</tspan>
                )}
                {edge.label.text}
                {edge.label.full === null ? null : <title>{edge.label.full}</title>}
              </text>
            </g>
          ),
        )}
      </svg>
    </div>
  );
};
