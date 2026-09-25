import { cn } from '@goodboy/ui';
import type { ArtifactKind } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { ARTIFACT_KIND_CONCEPT } from '../../artifactPresentation';

type Props = {
  readonly kind: ArtifactKind;
  readonly size: number;
  readonly className?: string;
};

export const ArtifactKindGlyph = ({ kind, size, className }: Props) => {
  const Icon = CONCEPT_ICONS[ARTIFACT_KIND_CONCEPT[kind]];
  return (
    <Icon
      size={size}
      strokeWidth={2}
      aria-hidden
      className={cn('shrink-0 text-muted-foreground', className)}
    />
  );
};
