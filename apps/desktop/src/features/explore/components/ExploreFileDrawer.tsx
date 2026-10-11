import { useState, type ReactNode } from 'react';
import { ArrowUpRight, ExternalLink, WrapText } from 'lucide-react';
import { Button, CopyButton, DrawerFrame, IconButton, SegmentedTabs, Tooltip } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { selectMountForPath } from '../../../store/slices/project-mounts/selectors';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../shared/components/conceptIcons';
import type { ExploreEntry } from '../explore';
import type { ExploreOpenFailure } from '../openFailure';
import { fileGlyphOf } from '../fileGlyph';
import { isCodeFile } from '../isCodeFile';
import { previewKindOf } from '../previewKindOf';
import { useExploreChanges } from '../hooks/useExploreChanges';
import { useExploreOpen } from '../hooks/useExploreOpen';
import { useExplorePreview } from '../hooks/useExplorePreview';
import { useExploreWrap } from '../hooks/useExploreWrap';
import { ExploreOpenError } from './ExploreOpenError';
import { ExplorePreviewPanel, type ExplorePreviewView } from './ExplorePane/ExplorePreviewPanel';

type RenderChangesParams = {
  readonly sessionDir: string;
  readonly relPath: string;
  readonly baseBranch: string | null;
};

type Props = {
  readonly sessionId: SessionId;
  readonly sessionDir: string;
  readonly entry: ExploreEntry;
  readonly line?: number;
  readonly renderChanges: (params: RenderChangesParams) => ReactNode;
  readonly onClose: () => void;
};

type DrawerView = ExplorePreviewView | 'changes';

type ViewOption = { readonly value: DrawerView; readonly label: string };

const PREVIEW_OPTION = { value: 'preview', label: 'Preview' } as const satisfies ViewOption;
const SOURCE_OPTION = { value: 'source', label: 'Source' } as const satisfies ViewOption;
const CHANGES_OPTION = { value: 'changes', label: 'Changes' } as const satisfies ViewOption;

const joinPath = ({ root, relPath }: { readonly root: string; readonly relPath: string }) => {
  if (relPath === '') {
    return root;
  }
  if (root.endsWith('/') || root.endsWith('\\')) {
    return `${root}${relPath}`;
  }
  return `${root}/${relPath}`;
};

export const ExploreFileDrawer = ({
  sessionId,
  sessionDir,
  entry,
  line,
  renderChanges,
  onClose,
}: Props) => {
  const previewState = useExplorePreview({ sessionDir, entry });
  const exploreOpen = useExploreOpen({ sessionId, sessionDir });
  const wrap = useExploreWrap();
  const [openFailure, setOpenFailure] = useState<ExploreOpenFailure | null>(null);
  const [view, setView] = useState<DrawerView>(line === undefined ? 'preview' : 'source');
  const isMount = useAppStore(
    (state) => selectMountForPath({ state, sessionId, path: sessionDir }) !== null,
  );
  const { changes, baseBranch } = useExploreChanges({
    sessionId,
    mountPath: isMount ? sessionDir : null,
  });
  const openMountDiff = useAppStore((state) => state.openMountDiff);
  const setDiffFocus = useAppStore((state) => state.setDiffFocus);
  const change = changes.byPath.get(entry.relPath) ?? null;
  const hasChanges = change !== null && change.status !== 'deleted';
  const isChangesView = hasChanges && view === 'changes';

  const previewKind = previewKindOf({ entry, previewState });
  const openAction = exploreOpen.actionOf({ entry });
  const hasSourceView = previewKind === 'markdown' || previewKind === 'svg';
  const previewView: ExplorePreviewView = view === 'source' ? 'source' : 'preview';
  const isSourceShown =
    !isChangesView && (previewKind === 'text' || (hasSourceView && previewView === 'source'));
  const isWrapShown = isSourceShown && isCodeFile({ name: entry.name });
  const isProseShown = isSourceShown && !isCodeFile({ name: entry.name });
  const viewOptions: ReadonlyArray<ViewOption> = [
    PREVIEW_OPTION,
    ...(hasSourceView ? [SOURCE_OPTION] : []),
    ...(hasChanges ? [CHANGES_OPTION] : []),
  ];
  const hasViewSwitch = viewOptions.length > 1;

  const open = () => {
    void exploreOpen.run({ entry, isReveal: false }).then(setOpenFailure);
  };

  const openInFiles = () => {
    openMountDiff(sessionId, sessionDir);
    setDiffFocus(sessionId, { kind: 'branch', path: entry.relPath });
  };

  const hasToolbar = hasViewSwitch || openFailure !== null;

  return (
    <DrawerFrame
      title={entry.name}
      icon={fileGlyphOf({ name: entry.name })}
      iconClassName="text-muted-foreground"
      onClose={onClose}
      scroll="self"
      action={
        <>
          {isChangesView ? (
            <Button variant="ghost" size="sm" onClick={openInFiles}>
              Open in Files
              <ArrowUpRight size={ICON_SIZE.row} aria-hidden />
            </Button>
          ) : null}
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
            {hasViewSwitch ? (
              <SegmentedTabs
                size="xs"
                ariaLabel="File view"
                options={viewOptions}
                value={isChangesView ? 'changes' : previewView}
                onChange={setView}
              />
            ) : null}
            {openFailure === null ? null : <ExploreOpenError failure={openFailure} />}
          </>
        ) : null
      }
    >
      {isChangesView ? (
        renderChanges({ sessionDir, relPath: entry.relPath, baseBranch })
      ) : (
        <ExplorePreviewPanel
          entry={entry}
          previewState={previewState}
          previewKind={previewKind}
          view={previewView}
          isWrapped={isProseShown || wrap.isWrapped}
          line={line}
        />
      )}
    </DrawerFrame>
  );
};
