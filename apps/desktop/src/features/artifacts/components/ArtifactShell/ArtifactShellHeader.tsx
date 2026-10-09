import { useCallback, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { ArtifactKind } from '@goodboy/types';
import type { ArtifactActionTarget } from '../../../actions/types';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import {
  ARTIFACT_HEADER_ANCHOR,
  ArtifactHeaderMenuContext,
  artifactViewingOf,
} from './artifactHeaderMenu';
import { ArtifactKindGlyph } from '../ArtifactList/ArtifactKindGlyph';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly kind: ArtifactKind;
  readonly title: string;
  readonly chip: ReactNode;
  readonly actions: ReactNode;
  readonly below?: ReactNode;
  readonly rootRef?: RefObject<HTMLDivElement | null>;
  readonly meta: ReactNode;
};

export const ArtifactShellHeader = ({
  kind,
  title,
  chip,
  actions,
  below = null,
  rootRef,
  meta,
}: Props) => {
  const targetRef = useRef<ArtifactActionTarget | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const register = useCallback((target: ArtifactActionTarget | null) => {
    targetRef.current = target;
    setViewingId(target === null ? null : (artifactViewingOf({ target })?.id ?? null));
  }, []);
  const readTarget = useCallback(() => targetRef.current, []);
  const menu = useObjectMenuTrigger({
    target: null,
    anchorKey: ARTIFACT_HEADER_ANCHOR,
    onBeforeOpen: readTarget,
    viewing: viewingId === null ? null : { kind: 'artifact', id: viewingId },
  });

  return (
    <ArtifactHeaderMenuContext.Provider value={register}>
      <div
        ref={rootRef}
        data-testid="artifact-shell-header"
        className="flex min-w-0 flex-col gap-0.5"
        onContextMenu={menu.onContextMenu}
        onKeyDown={menu.onKeyDown}
      >
        <div className="flex min-h-8 min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <ArtifactKindGlyph kind={kind} size={ICON_SIZE.control} />
          <h1
            data-testid="artifact-title"
            title={title}
            className="min-w-0 flex-1 truncate text-title text-foreground"
          >
            {title}
          </h1>
          {chip}
          {actions}
        </div>
        {below}
        {meta === null ? null : (
          <div data-testid="artifact-shell-meta" className="flex min-w-0 pl-6">
            {meta}
          </div>
        )}
      </div>
    </ArtifactHeaderMenuContext.Provider>
  );
};
