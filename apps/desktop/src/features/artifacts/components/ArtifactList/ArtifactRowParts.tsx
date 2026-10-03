import { WorkNode, cn } from '@goodboy/ui';
import type { ArtifactRowPart } from '../../artifactListRows';
import { ARTIFACT_ROW_GRID } from './artifactRowGrid';

type Props = {
  readonly parts: ReadonlyArray<ArtifactRowPart>;
};

export const ArtifactRowParts = ({ parts }: Props) => (
  <ul data-testid="artifact-row-parts" className="flex min-w-0 flex-col pb-1">
    {parts.map((part) => (
      <li
        key={part.index}
        className={cn(ARTIFACT_ROW_GRID.frame, 'min-h-6 text-label', ARTIFACT_ROW_GRID.partsIndent)}
      >
        <WorkNode
          state={part.nodeState}
          size="sm"
          mark={{ kind: 'index', value: String(part.index + 1) }}
          label={part.nodeLabel}
        />
        <span className="min-w-0 flex-1 truncate text-muted-foreground" title={part.title}>
          {part.title}
        </span>
        <span
          className={cn(ARTIFACT_ROW_GRID.state, 'px-1.5 text-secondary text-faint-foreground')}
        >
          {part.nodeLabel}
        </span>
        <span aria-hidden className={cn(ARTIFACT_ROW_GRID.date, 'invisible')} />
        <span aria-hidden className={ARTIFACT_ROW_GRID.tail} />
      </li>
    ))}
  </ul>
);
