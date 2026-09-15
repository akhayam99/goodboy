import type { WireframeDocument } from '@goodboy/core';
import type { WireframeIndex } from '../../wireframeIndex';

type Props = {
  readonly document: WireframeDocument;
  readonly index: WireframeIndex;
  readonly currentScreenId: string;
  readonly onSelectScreen: (screenId: string) => void;
};

const BOX_WIDTH = 132;
const BOX_HEIGHT = 44;
const GAP_X = 46;
const GAP_Y = 64;
const PER_ROW = 4;

export const WireframeFlowOverview = ({
  document,
  index,
  currentScreenId,
  onSelectScreen,
}: Props) => {
  const positions = new Map<string, { readonly x: number; readonly y: number }>();
  document.screens.forEach((screen, order) => {
    const column = order % PER_ROW;
    const row = Math.floor(order / PER_ROW);
    positions.set(screen.id, {
      x: column * (BOX_WIDTH + GAP_X) + 8,
      y: row * (BOX_HEIGHT + GAP_Y) + 8,
    });
  });
  const rows = Math.ceil(document.screens.length / PER_ROW);
  const width = Math.min(document.screens.length, PER_ROW) * (BOX_WIDTH + GAP_X) + 8;
  const height = rows * (BOX_HEIGHT + GAP_Y) + 8;
  const screenOf = (nodeId: string): string | undefined => index.screenByNodeId.get(nodeId);

  return (
    <div className="overflow-x-auto">
      <svg
        data-testid="wireframe-flow-overview"
        role="img"
        aria-label="Wireframe flow overview"
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="max-w-full"
      >
        <defs>
          <marker
            id="wireframe-flow-arrow"
            markerWidth="7"
            markerHeight="7"
            refX="6"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 Z" className="fill-muted-foreground" />
          </marker>
        </defs>
        {document.transitions.map((transition, order) => {
          const fromId = screenOf(transition.fromNodeId);
          const from = fromId === undefined ? undefined : positions.get(fromId);
          const to = positions.get(transition.toScreenId);
          if (from === undefined || to === undefined) {
            return null;
          }
          const x1 = from.x + BOX_WIDTH / 2;
          const y1 = from.y + BOX_HEIGHT;
          const x2 = to.x + BOX_WIDTH / 2;
          const y2 = to.y;
          return (
            <g key={`${transition.fromNodeId}-${transition.toScreenId}-${order}`}>
              <path
                d={`M ${x1} ${y1} C ${x1} ${y1 + 26}, ${x2} ${y2 - 26}, ${x2} ${y2}`}
                fill="none"
                className="stroke-border"
                strokeWidth="1"
                markerEnd="url(#wireframe-flow-arrow)"
              />
              <text
                x={(x1 + x2) / 2}
                y={(y1 + y2) / 2}
                textAnchor="middle"
                className="fill-muted-foreground text-[8px]"
              >
                {transition.label}
              </text>
            </g>
          );
        })}
        {document.screens.map((screen) => {
          const position = positions.get(screen.id);
          if (position === undefined) {
            return null;
          }
          const isCurrent = screen.id === currentScreenId;
          return (
            <g
              key={screen.id}
              role="button"
              tabIndex={0}
              aria-label={`Go to ${screen.title}`}
              className="cursor-pointer"
              onClick={() => onSelectScreen(screen.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  onSelectScreen(screen.id);
                }
              }}
            >
              <rect
                x={position.x}
                y={position.y}
                width={BOX_WIDTH}
                height={BOX_HEIGHT}
                rx="6"
                className={isCurrent ? 'fill-muted stroke-primary' : 'fill-elevated stroke-border'}
                strokeWidth="1"
              />
              <text
                x={position.x + BOX_WIDTH / 2}
                y={position.y + BOX_HEIGHT / 2 + 3}
                textAnchor="middle"
                className="fill-foreground text-[10px]"
              >
                {screen.title}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
