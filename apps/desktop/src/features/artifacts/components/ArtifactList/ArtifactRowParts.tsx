import { WorkNode, cn, TruncatedText } from '@goodboy/ui';
import type { ArtifactRowPart } from '../../artifactListRows';
import { ARTIFACT_ROW_GRID } from './artifactRowGrid';

type Props = {
  readonly parts: ReadonlyArray<ArtifactRowPart>;
  readonly hasActionColumn: boolean;
};

export const ArtifactRowParts = ({ parts, hasActionColumn }: Props) => (
  <ul data-testid="artifact-row-parts" className="flex min-w-0 flex-col pb-1">
    {parts.map((part) => (
      <li
        key={part.index}
        className={cn(ARTIFACT_ROW_GRID.frame, 'min-h-6 text-meta', ARTIFACT_ROW_GRID.partsIndent)}
      >
        <WorkNode
          state={part.nodeState}
          size="sm"
          mark={{ kind: 'index', value: String(part.index + 1) }}
          label={part.nodeLabel}
        />
        <TruncatedText className="min-w-0 flex-1 truncate text-muted-foreground">
          {part.title}
        </TruncatedText>
        <span className={cn(ARTIFACT_ROW_GRID.state, 'text-meta text-faint-foreground')}>
          {part.nodeLabel}
        </span>
        <span aria-hidden className={cn(ARTIFACT_ROW_GRID.date, 'invisible')} />
        {hasActionColumn ? <span aria-hidden className={ARTIFACT_ROW_GRID.action} /> : null}
      </li>
    ))}
  </ul>
);
