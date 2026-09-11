import { Tooltip, cn } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly projectKind: 'repo' | 'folder';
  readonly isMainCheckout: boolean;
  readonly label: string;
};

export const MountKindGlyph = ({ projectKind, isMainCheckout, label }: Props) => {
  const isFolder = projectKind === 'folder';
  const Glyph = isFolder
    ? CONCEPT_ICONS.projectFolder
    : isMainCheckout
      ? CONCEPT_ICONS.projectRepo
      : CONCEPT_ICONS.worktree;
  const kind = isFolder ? 'folder' : isMainCheckout ? 'main checkout' : 'worktree';

  return (
    <Tooltip content={`${label} is the ${kind}`}>
      <span
        data-testid="mount-kind-glyph"
        data-kind={kind}
        aria-label={`${label} is the ${kind}`}
        className="inline-flex shrink-0 items-center"
      >
        <Glyph
          size={ICON_SIZE.row}
          aria-hidden
          className={cn(
            'shrink-0',
            isMainCheckout ? 'text-foreground/70' : 'text-muted-foreground',
          )}
        />
      </span>
    </Tooltip>
  );
};
