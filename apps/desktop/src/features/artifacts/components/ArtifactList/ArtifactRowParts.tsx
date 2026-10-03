import { WorkNode } from '@goodboy/ui';
import type { ArtifactRowPart } from '../../artifactListRows';

type Props = {
  readonly parts: ReadonlyArray<ArtifactRowPart>;
};

export const ArtifactRowParts = ({ parts }: Props) => (
  <ul data-testid="artifact-row-parts" className="flex min-w-0 flex-col pb-1 pl-[62px]">
    {parts.map((part) => (
      <li key={part.index} className="flex min-h-6 min-w-0 items-center gap-2 text-label">
        <WorkNode
          state={part.nodeState}
          size="sm"
          mark={{ kind: 'index', value: String(part.index + 1) }}
          label={part.nodeLabel}
        />
        <span className="min-w-0 flex-1 truncate text-muted-foreground" title={part.title}>
          {part.title}
        </span>
        <span className="shrink-0 text-secondary text-faint-foreground">{part.nodeLabel}</span>
      </li>
    ))}
  </ul>
);
