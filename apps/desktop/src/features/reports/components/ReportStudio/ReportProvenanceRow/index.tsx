import { useState } from 'react';
import { cn, EmptyLine, Eyebrow, ICON_SIZE, Tooltip } from '@goodboy/ui';
import type { AgentId, ArtifactId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import type { ReportSourceLink } from '../../../reportSourceLinks';

type Props = {
  readonly reportType: string;
  readonly links: ReadonlyArray<ReportSourceLink>;
  readonly onOpenAgent: (agentId: AgentId) => void;
  readonly onOpenArtifact: (artifactId: ArtifactId) => void;
};

const COLLAPSED_LIMIT = 4;

const chipClass =
  'inline-flex min-w-0 max-w-[13rem] items-center gap-1 rounded-full border border-border-soft px-2 py-0.5 text-chip text-muted-foreground motion-safe:transition-colors hover:border-border hover:bg-hover hover:text-foreground';

export const ReportProvenanceRow = ({ reportType, links, onOpenAgent, onOpenArtifact }: Props) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const overflow = links.length - COLLAPSED_LIMIT;
  const visible = isExpanded || overflow <= 0 ? links : links.slice(0, COLLAPSED_LIMIT);

  return (
    <div
      data-testid="report-provenance"
      className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-meta text-muted-foreground"
    >
      <Eyebrow label={reportType} className="shrink-0 rounded-sm bg-muted px-2 py-0.5" />
      {links.length === 0 ? (
        <EmptyLine className="min-h-0 shrink-0">No sources from this session</EmptyLine>
      ) : (
        <Eyebrow label="sources" className="shrink-0" />
      )}
      {visible.map((link) => {
        const Glyph = link.kind === 'agent' ? CONCEPT_ICONS.agents : CONCEPT_ICONS.plans;
        const hint = link.kind === 'agent' ? 'open the agent' : 'open the plan';
        return (
          <Tooltip key={`${link.kind}-${link.id}`} content={`${hint} ${link.label}`}>
            <button
              type="button"
              className={cn(chipClass)}
              aria-label={`${hint} ${link.label}`}
              data-testid="report-source-chip"
              onClick={() =>
                link.kind === 'agent' ? onOpenAgent(link.id) : onOpenArtifact(link.id)
              }
            >
              <Glyph size={ICON_SIZE.row} className="shrink-0" aria-hidden />
              <span className="truncate">{link.label}</span>
            </button>
          </Tooltip>
        );
      })}
      {overflow > 0 && !isExpanded && (
        <button
          type="button"
          className={cn(chipClass, 'shrink-0 tabular-nums')}
          data-testid="report-sources-more"
          onClick={() => setIsExpanded(true)}
        >
          +{overflow} more
        </button>
      )}
      {overflow > 0 && isExpanded && (
        <button
          type="button"
          className={cn(chipClass, 'shrink-0')}
          data-testid="report-sources-less"
          onClick={() => setIsExpanded(false)}
        >
          show fewer
        </button>
      )}
    </div>
  );
};
