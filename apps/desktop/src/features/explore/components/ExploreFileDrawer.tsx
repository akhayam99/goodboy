import { useState } from 'react';
import { ExternalLink, WrapText } from 'lucide-react';
import { Button, CopyButton, DrawerFrame, IconButton, SegmentedTabs, Tooltip } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../shared/components/conceptIcons';
import type { ExploreEntry } from '../explore';
import type { ExploreOpenFailure } from '../openFailure';
import { fileGlyphOf } from '../fileGlyph';
import { isCodeFile } from '../isCodeFile';
import { previewKindOf } from '../previewKindOf';
import { useExploreOpen } from '../hooks/useExploreOpen';
import { useExplorePreview } from '../hooks/useExplorePreview';
import { useExploreWrap } from '../hooks/useExploreWrap';
import { ExploreOpenError } from './ExploreOpenError';
import { ExplorePreviewPanel, type ExplorePreviewView } from './ExplorePane/ExplorePreviewPanel';

type Props = {
  readonly sessionId: SessionId;
  readonly sessionDir: string;
  readonly entry: ExploreEntry;
  readonly onClose: () => void;
};

const VIEW_OPTIONS = [
  { value: 'preview', label: 'Preview' },
  { value: 'source', label: 'Source' },
] as const satisfies ReadonlyArray<{ readonly value: ExplorePreviewView; readonly label: string }>;

const joinPath = ({ root, relPath }: { readonly root: string; readonly relPath: string }) => {
  if (relPath === '') {
    return root;
  }
  if (root.endsWith('/') || root.endsWith('\\')) {
    return `${root}${relPath}`;
  }
  return `${root}/${relPath}`;
};

export const ExploreFileDrawer = ({ sessionId, sessionDir, entry, onClose }: Props) => {
  const previewState = useExplorePreview({ sessionDir, entry });
  const exploreOpen = useExploreOpen({ sessionId, sessionDir });
  const wrap = useExploreWrap();
  const [openFailure, setOpenFailure] = useState<ExploreOpenFailure | null>(null);
  const [view, setView] = useState<ExplorePreviewView>('preview');

  const previewKind = previewKindOf({ entry, previewState });
  const openAction = exploreOpen.actionOf({ entry });
  const hasSourceView = previewKind === 'markdown' || previewKind === 'svg';
  const isSourceShown = previewKind === 'text' || (hasSourceView && view === 'source');
  const isWrapShown = isSourceShown && isCodeFile({ name: entry.name });
  const isProseShown = isSourceShown && !isCodeFile({ name: entry.name });

  const open = () => {
    void exploreOpen.run({ entry, isReveal: false }).then(setOpenFailure);
  };

  const hasToolbar = hasSourceView || openFailure !== null;

  return (
    <DrawerFrame
      title={entry.name}
      icon={fileGlyphOf({ name: entry.name })}
      iconClassName="text-muted-foreground"
      onClose={onClose}
      scroll="self"
      action={
        <>
          <Tooltip content={openAction.tooltip}>
            <Button size="sm" variant="secondary" onClick={open}>
              {openAction.editor === null ? (
                <ExternalLink size={ICON_SIZE.row} aria-hidden />
              ) : (
                <CONCEPT_ICONS.editor size={ICON_SIZE.row} aria-hidden />
              )}
              {openAction.label}
            </Button>
          </Tooltip>
          <CopyButton
            presentation="icon"
            label="Copy path"
            size={ICON_SIZE.control}
            className="size-7 justify-center"
            value={joinPath({ root: sessionDir, relPath: entry.relPath })}
          />
          {isWrapShown ? (
            <IconButton
              icon={WrapText}
              label="Wrap lines"
              aria-pressed={wrap.isWrapped}
              onClick={wrap.toggle}
            />
          ) : null}
        </>
      }
      toolbar={
        hasToolbar ? (
          <>
            {hasSourceView ? (
              <SegmentedTabs
                size="xs"
                ariaLabel="File view"
                options={VIEW_OPTIONS}
                value={view}
                onChange={setView}
              />
            ) : null}
            {openFailure === null ? null : <ExploreOpenError failure={openFailure} />}
          </>
        ) : null
      }
    >
      <ExplorePreviewPanel
        entry={entry}
        previewState={previewState}
        previewKind={previewKind}
        view={view}
        isWrapped={isProseShown || wrap.isWrapped}
      />
    </DrawerFrame>
  );
};
