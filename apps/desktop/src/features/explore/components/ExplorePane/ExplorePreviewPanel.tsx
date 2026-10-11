import { useState, type ReactNode } from 'react';
import { Button, Markdown, ScrollFade, Skeleton, EmptyState } from '@goodboy/ui';
import { ImageLightbox } from '../../../chat/components/ImageLightbox';
import { type ExploreEntry } from '../../explore';
import type { ExplorePreviewState } from '../../hooks/useExplorePreview';
import type { ExplorePreviewKind } from '../../previewKindOf';
import { ExplorePathLine } from './ExplorePathLine';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { SourceView } from '../../../../shared/components/SourceView';

export type ExplorePreviewView = 'preview' | 'source';

type Props = {
  readonly entry: ExploreEntry;
  readonly previewState: ExplorePreviewState;
  readonly previewKind: ExplorePreviewKind;
  readonly view: ExplorePreviewView;
  readonly isWrapped: boolean;
};

type SvgParams = {
  readonly text: string;
};

const svgDataUrl = ({ text }: SvgParams): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;

const TRUNCATED_LINE = 'Preview is truncated to 256 KB.';

export const ExplorePreviewPanel = ({
  entry,
  previewState,
  previewKind,
  view,
  isWrapped,
}: Props) => {
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);

  const renderBody = (): ReactNode => {
    if (previewState.status === 'loading') {
      return (
        <div className="flex flex-col gap-2 px-4 pb-3">
          <Skeleton className="h-4 w-3/4 rounded-md" />
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-11/12 rounded-md" />
          <Skeleton className="h-4 w-9/12 rounded-md" />
        </div>
      );
    }
    if (previewState.status === 'error') {
      return (
        <div className="px-4 pb-3">
          <EmptyState
            size="section"
            icon={CONCEPT_ICONS.errors}
            tone={CONCEPT_TONE.errors}
            title="Couldn't read this file"
            description={previewState.message}
          />
        </div>
      );
    }
    if (previewState.status === 'unsupported') {
      return (
        <p className="px-4 pb-3 text-label text-muted-foreground">
          This file is binary. Open it in the app that owns it.
        </p>
      );
    }
    const { content } = previewState;
    if (content.type === 'text') {
      const isTruncated = content.truncated;
      const truncatedLine = isTruncated ? (
        <p className="text-label text-muted-foreground">{TRUNCATED_LINE}</p>
      ) : null;
      if (previewKind === 'markdown' && view === 'preview') {
        return (
          <ScrollFade
            className="min-h-0 flex-1"
            viewportClassName="flex flex-col gap-2 px-4 pb-3"
            fadeSize={24}
          >
            {truncatedLine}
            <Markdown text={content.text} className="text-body text-foreground" />
          </ScrollFade>
        );
      }
      if (previewKind === 'svg' && view === 'preview') {
        return (
          <ScrollFade
            className="min-h-0 flex-1"
            viewportClassName="flex flex-col gap-2 px-4 pb-3"
            fadeSize={24}
          >
            {truncatedLine}
            <img
              src={svgDataUrl({ text: content.text })}
              alt={entry.name}
              className="max-h-[30rem] w-full rounded-md object-contain ring-1 ring-border-soft"
            />
          </ScrollFade>
        );
      }
      return (
        <>
          {isTruncated ? (
            <p className="px-4 pb-2 text-label text-muted-foreground">{TRUNCATED_LINE}</p>
          ) : null}
          <SourceView text={content.text} path={entry.name} isWrapped={isWrapped} />
        </>
      );
    }
    if (previewKind === 'image' && content.type === 'dataUrl') {
      return (
        <ScrollFade className="min-h-0 flex-1" viewportClassName="px-4 pb-3" fadeSize={24}>
          <img
            src={content.url}
            alt={entry.name}
            className="max-h-[30rem] w-full rounded-md object-contain ring-1 ring-border-soft"
          />
        </ScrollFade>
      );
    }
    if (previewKind === 'pdf' && content.type === 'dataUrl') {
      return (
        <div className="flex flex-col items-start gap-2 px-4 pb-3">
          <p className="text-label text-muted-foreground">PDF previews open in a focused viewer.</p>
          <Button size="sm" variant="secondary" onClick={() => setIsPdfViewerOpen(true)}>
            Open PDF preview
          </Button>
          {isPdfViewerOpen ? (
            <ImageLightbox
              media="pdf"
              src={content.url}
              alt={entry.name}
              onClose={() => setIsPdfViewerOpen(false)}
            />
          ) : null}
        </div>
      );
    }
    return (
      <p className="px-4 pb-3 text-label text-muted-foreground">
        This file is binary. Open it in the app that owns it.
      </p>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ExplorePathLine entry={entry} />
      {renderBody()}
    </div>
  );
};
