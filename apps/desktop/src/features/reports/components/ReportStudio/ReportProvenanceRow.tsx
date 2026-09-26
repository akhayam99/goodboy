import { useState } from 'react';
import { cn } from '@goodboy/ui';
import type { AgentId, ArtifactId } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ReportSourceLink } from '../../reportSourceLinks';

type Props = {
  readonly reportType: string;
  readonly links: ReadonlyArray<ReportSourceLink>;
  readonly onOpenAgent: (agentId: AgentId) => void;
  readonly onOpenArtifact: (artifactId: ArtifactId) => void;
};

const COLLAPSED_LIMIT = 4;

const chipClass =
  'inline-flex min-w-0 max-w-[13rem] items-center gap-1 rounded-full border border-border-soft px-2 py-0.5 text-secondary text-muted-foreground motion-safe:transition-colors hover:border-border hover:bg-hover hover:text-foreground';

export const ReportProvenanceRow = ({ reportType, links, onOpenAgent, onOpenArtifact }: Props) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const overflow = links.length - COLLAPSED_LIMIT;
  const visible = isExpanded || overflow <= 0 ? links : links.slice(0, COLLAPSED_LIMIT);

  return (
    <div
      data-testid="report-provenance"
      className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-secondary text-muted-foreground"
    >
      <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 uppercase tracking-eyebrow">
        {reportType}
      </span>
      {links.length === 0 ? (
        <span className="shrink-0">no cited source maps to this session</span>
      ) : (
        <span className="shrink-0 uppercase tracking-eyebrow">sources</span>
      )}
      {visible.map((link) => {
        const Glyph = link.kind === 'agent' ? CONCEPT_ICONS.agents : CONCEPT_ICONS.plans;
        const hint = link.kind === 'agent' ? 'open the agent' : 'open the plan';
        return (
          <button
            key={`${link.kind}-${link.id}`}
            type="button"
            className={cn(chipClass)}
            title={`${hint} ${link.label}`}
            aria-label={`${hint} ${link.label}`}
            data-testid="report-source-chip"
            onClick={() =>
              link.kind === 'agent'
                ? onOpenAgent(link.id as AgentId)
                : onOpenArtifact(link.id as ArtifactId)
            }
          >
            <Glyph size={ICON_SIZE.row} className="shrink-0" aria-hidden />
            <span className="truncate">{link.label}</span>
          </button>
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
