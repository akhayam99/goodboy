import { ChevronRight } from 'lucide-react';
import { Chip, ICON_SIZE, cn, tintClasses } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import type { ArtifactApprovalView } from './artifactApprovalOf';

export type ArtifactLinkModel = Readonly<{
  artifactId: string;
  kindLabel: string;
  title: string;
  revision: number | null;
  approval: ArtifactApprovalView | null;
}>;

type Props = {
  readonly link: ArtifactLinkModel;
  readonly onOpen: (artifactId: string) => void;
};

const accent = tintClasses(CONCEPT_TONE.plans);

export const ArtifactLinkRow = ({ link, onOpen }: Props) => (
  <button
    type="button"
    onClick={() => onOpen(link.artifactId)}
    aria-label={`Open ${link.kindLabel.toLowerCase()} ${link.title}`}
    className={cn(
      'flex min-w-0 items-center gap-2 rounded-md border px-3 py-2 text-left text-label motion-safe:transition-colors hover:bg-hover',
      accent.border,
      accent.bg,
    )}
  >
    <CONCEPT_ICONS.plans
      size={ICON_SIZE.row}
      aria-hidden
      className="shrink-0 text-muted-foreground"
    />
    <span className="min-w-0 flex-1 truncate text-row text-foreground">
      {link.kindLabel} · {link.title}
    </span>
    {link.revision === null ? null : (
      <span className="shrink-0 text-meta tabular-nums text-muted-foreground">
        v{link.revision}
      </span>
    )}
    {link.approval === null ? null : (
      <Chip kind="state" tone={link.approval.tone} shape="badge" label={link.approval.word} />
    )}
    <ChevronRight size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
  </button>
);
