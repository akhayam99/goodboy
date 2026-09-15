import { cn } from '@goodboy/ui';
import type { AgentId, ArtifactId } from '@goodboy/types';
import type { ReportSourceLink } from '../../reportSourceLinks';

type Props = {
  readonly reportType: string;
  readonly links: ReadonlyArray<ReportSourceLink>;
  readonly onOpenAgent: (agentId: AgentId) => void;
  readonly onOpenArtifact: (artifactId: ArtifactId) => void;
};

const linkClass = 'truncate underline-offset-2 hover:text-foreground hover:underline';

export const ReportProvenanceRow = ({ reportType, links, onOpenAgent, onOpenArtifact }: Props) => (
  <div
    data-testid="report-provenance"
    className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-muted-foreground"
  >
    <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 uppercase tracking-wide">
      {reportType}
    </span>
    {links.length === 0 ? (
      <span className="shrink-0">no cited source maps to this session</span>
    ) : (
      <span className="shrink-0">sources</span>
    )}
    {links.map((link) => (
      <button
        key={`${link.kind}-${link.id}`}
        type="button"
        className={cn(linkClass)}
        onClick={() =>
          link.kind === 'agent'
            ? onOpenAgent(link.id as AgentId)
            : onOpenArtifact(link.id as ArtifactId)
        }
      >
        {link.label}
      </button>
    ))}
  </div>
);
