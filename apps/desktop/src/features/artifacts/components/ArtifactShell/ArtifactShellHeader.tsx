import { ICON_SIZE, PaneTitleRow, TruncatedText } from '@goodboy/ui';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import type { ArtifactKind } from '@goodboy/types';
import type { ArtifactActionTarget } from '../../../actions/types';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import {
  ARTIFACT_HEADER_ANCHOR,
  ArtifactHeaderMenuContext,
  artifactViewingOf,
} from './artifactHeaderMenu';
import { ArtifactKindGlyph } from '../ArtifactList/ArtifactKindGlyph';

type Props = {
  readonly kind: ArtifactKind;
  readonly title: string;
  readonly isTitleInDocument?: boolean;
  readonly chip: ReactNode;
  readonly actions: ReactNode;
  readonly meta: ReactNode;
};

export const ArtifactShellHeader = ({
  kind,
  title,
  isTitleInDocument = false,
  chip,
  actions,
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
        data-testid="artifact-shell-header"
        className="min-w-0"
        onContextMenu={menu.onContextMenu}
        onKeyDown={menu.onKeyDown}
      >
        <PaneTitleRow
          titleTestId="artifact-title"
          title={
            isTitleInDocument ? (
              <span className="sr-only">{title}</span>
            ) : (
              <span className="flex min-w-0 items-center gap-2">
                <ArtifactKindGlyph kind={kind} size={ICON_SIZE.control} />
                <TruncatedText as="span" className="min-w-0 flex-1">
                  {title}
                </TruncatedText>
              </span>
            )
          }
          meta={
            meta === null ? null : (
              <div data-testid="artifact-shell-meta" className="flex min-w-0 pl-6">
                {meta}
              </div>
            )
          }
          actions={
            <>
              {chip}
              {actions}
            </>
          }
        />
      </div>
    </ArtifactHeaderMenuContext.Provider>
  );
};
