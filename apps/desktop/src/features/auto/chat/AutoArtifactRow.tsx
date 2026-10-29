import { Chip, ICON_SIZE } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import type { ArtifactLinkModel } from './artifactLinksOf';

type Props = {
  readonly link: ArtifactLinkModel;
  readonly onOpen: (artifactId: string) => void;
};

export const AutoArtifactRow = ({ link, onOpen }: Props) => (
  <div data-artifact-row={link.artifactId} className="flex min-w-0 flex-col gap-0.5">
    <span className="flex min-w-0 items-center gap-2 text-meta">
      <Chip
        as="button"
        kind="reference"
        tone={CONCEPT_TONE.plans}
        icon={<CONCEPT_ICONS.artifacts size={ICON_SIZE.row} aria-hidden />}
        label={<span className="min-w-0 truncate">{`${link.kindLabel} · ${link.title}`}</span>}
        ariaLabel={`Open ${link.kindLabel.toLowerCase()} ${link.title}`}
        testId="artifact-row-chip"
        className="min-w-0 max-w-full"
        onClick={() => onOpen(link.artifactId)}
      />
      {link.revision !== null && link.revision > 1 ? (
        <span className="shrink-0 text-muted-foreground">v{link.revision}</span>
      ) : null}
      {link.approval?.state === 'approved' ? (
        <span className="shrink-0 text-success">{link.approval.word}</span>
      ) : null}
    </span>
    {link.lead === null ? null : (
      <p className="min-w-0 truncate text-meta text-muted-foreground">{link.lead}</p>
    )}
  </div>
);
