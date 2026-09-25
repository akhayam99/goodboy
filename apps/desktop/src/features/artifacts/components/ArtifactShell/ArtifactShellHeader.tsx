import type { ReactNode } from 'react';
import type { ArtifactKind } from '@goodboy/types';
import { ArtifactKindGlyph } from '../ArtifactList/ArtifactKindGlyph';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly kind: ArtifactKind;
  readonly title: string;
  readonly chip: ReactNode;
  readonly actions: ReactNode;
  readonly toggles: ReactNode;
  readonly meta: ReactNode;
};

export const ArtifactShellHeader = ({ kind, title, chip, actions, toggles, meta }: Props) => (
  <div data-testid="artifact-shell-header" className="flex min-w-0 flex-col gap-0.5">
    <div className="flex min-h-8 min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <ArtifactKindGlyph kind={kind} size={ICON_SIZE.control} />
      <h1
        data-testid="artifact-title"
        title={title}
        className="min-w-0 flex-1 truncate text-lg font-semibold leading-6 text-foreground"
      >
        {title}
      </h1>
      {chip}
      <span className="flex min-w-0 shrink-0 items-center gap-1.5">
        {actions}
        {toggles}
      </span>
    </div>
    {meta === null ? null : (
      <div data-testid="artifact-shell-meta" className="flex min-w-0 pl-5.5">
        {meta}
      </div>
    )}
  </div>
);
