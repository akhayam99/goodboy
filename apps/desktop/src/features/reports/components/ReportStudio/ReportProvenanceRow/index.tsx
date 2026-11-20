import { useState } from 'react';
import { Chip, EmptyLine, Eyebrow, ICON_SIZE } from '@goodboy/ui';
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

const SOURCE_CHIP = 'min-w-0 max-w-[13rem] shrink';

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
        const hint = `${link.kind === 'agent' ? 'Open agent' : 'Open plan'} ${link.label}`;
        return (
          <Chip
            key={`${link.kind}-${link.id}`}
            as="button"
            kind="reference"
            tone="neutral"
            title={hint}
            ariaLabel={hint}
            testId="report-source-chip"
            className={SOURCE_CHIP}
            icon={<Glyph size={ICON_SIZE.row} className="shrink-0" aria-hidden />}
            label={<span className="truncate">{link.label}</span>}
            onClick={() => (link.kind === 'agent' ? onOpenAgent(link.id) : onOpenArtifact(link.id))}
          />
        );
      })}
      {overflow > 0 && !isExpanded && (
        <Chip
          as="button"
          kind="reference"
          tone="neutral"
          testId="report-sources-more"
          className="tabular-nums"
          label={`+${overflow} more`}
          onClick={() => setIsExpanded(true)}
        />
      )}
      {overflow > 0 && isExpanded && (
        <Chip
          as="button"
          kind="reference"
          tone="neutral"
          testId="report-sources-less"
          label="Show fewer"
          onClick={() => setIsExpanded(false)}
        />
      )}
    </div>
  );
};
