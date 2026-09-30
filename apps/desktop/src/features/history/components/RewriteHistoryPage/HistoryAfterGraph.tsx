import { cn } from '@goodboy/ui';
import { HISTORY_ACTION_CLASSES } from '../../historyActionClasses';
import { historyAfterLayout } from '../../historyAfterLayout';
import { HISTORY_GRAPH } from '../../historyGraphGeometry';
import type { HistoryRowMark } from '../../historyRowMarks';
import type { RowPositions } from '../../useRowPositions';
import { HistoryLaneSvg, type LaneNode } from './HistoryLaneSvg';

type Props = {
  readonly keep: ReadonlyArray<string>;
  readonly marks: ReadonlyMap<string, HistoryRowMark>;
  readonly positions: RowPositions;
  readonly isOnMain: boolean;
  readonly highlighted: ReadonlySet<string>;
  readonly workingSha: string | null;
  readonly titleOf: (sha: string) => string;
  readonly onHover: (sha: string | null) => void;
};

const TOP_GAP = 40;

export const HistoryAfterGraph = ({
  keep,
  marks,
  positions,
  isOnMain,
  highlighted,
  workingSha,
  titleOf,
  onHover,
}: Props) => {
  const forkY = positions.y.get('fork') ?? null;
  const mainY = positions.y.get('main') ?? null;
  if (forkY === null) {
    return <div aria-hidden className="relative" style={{ height: positions.height }} />;
  }
  const topY = (mainY ?? 0) + TOP_GAP;
  const placed = historyAfterLayout({ keep, rowY: positions.y, forkY, topY });
  const nodes: ReadonlyArray<LaneNode> = [...keep].reverse().map((sha) => {
    const mark = marks.get(sha);
    return {
      key: sha,
      y: placed.get(sha) ?? forkY,
      color: mark?.action ?? 'pick',
      ring: mark !== undefined && mark.takesIn.length > 0 ? mark.takesInMode : null,
      isHighlighted: highlighted.has(sha),
      isWorking: workingSha === sha,
    };
  });
  return (
    <div className="relative" style={{ height: positions.height }}>
      <HistoryLaneSvg
        width={HISTORY_GRAPH.afterWidth}
        height={positions.height}
        trunkX={HISTORY_GRAPH.afterTrunkX}
        laneX={HISTORY_GRAPH.afterLaneX}
        mainY={isOnMain ? null : mainY}
        forkY={forkY}
        mainDots={[]}
        nodes={nodes}
        isDashed
        isForkOnMain={isOnMain}
        isTweened
      />
      <ul aria-label="After Apply" className="contents">
        {nodes.map((node) => {
          const mark = marks.get(node.key);
          const count = mark?.takesIn.length ?? 0;
          return (
            <li
              key={node.key}
              data-after-node={node.key}
              data-highlighted={node.isHighlighted ? 'true' : undefined}
              style={{ top: node.y }}
              onPointerEnter={() => onHover(node.key)}
              onPointerLeave={() => onHover(null)}
              className={cn(
                'absolute left-14 right-1 flex -translate-y-1/2 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-label whitespace-nowrap text-foreground transition-[top] duration-380 ease-out motion-reduce:transition-none',
                node.isHighlighted && 'bg-selected',
              )}
            >
              <span className="min-w-0 truncate">{titleOf(node.key)}</span>
              {count > 0 && mark?.takesInMode != null ? (
                <span
                  className={cn(
                    'shrink-0 text-secondary tabular-nums',
                    HISTORY_ACTION_CLASSES[mark.takesInMode].text,
                  )}
                >
                  +{count}
                </span>
              ) : null}
            </li>
          );
        })}
        {isOnMain ? (
          <li
            style={{ top: forkY }}
            className="absolute left-14 right-1 -translate-y-1/2 px-1.5 text-label text-faint-foreground"
          >
            today&apos;s main
          </li>
        ) : null}
      </ul>
    </div>
  );
};
