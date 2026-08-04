import { useMemo, useState, type ReactNode } from 'react';
import {
  Button,
  CopyButton,
  Divider,
  EmptyState,
  Markdown,
  ScrollFade,
  Skeleton,
} from '@goodboy/ui';
import { ExternalLink } from 'lucide-react';
import { ImageLightbox } from '../../../chat/components/ImageLightbox';
import { type ExploreContent, type ExploreEntry } from '../../explore';
import { formatRelativeAge } from '../../../../shared/utils/relativeDate';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { PANE_RHYTHM } from '../../../../shared/components/paneRhythm';
import { InspectorHeader } from '../../../session/components/SessionWorkspace/parts/InspectorSplit/InspectorHeader';

type PreviewState =
  | {
      readonly status: 'loading';
    }
  | {
      readonly status: 'unsupported';
    }
  | {
      readonly status: 'error';
      readonly message: string;
    }
  | {
      readonly status: 'ready';
      readonly content: ExploreContent;
    };

type Props = {
  readonly entry: ExploreEntry;
  readonly previewState: PreviewState;
  readonly absolutePath: string;
  readonly onClose: () => void;
  readonly onOpenOutside: () => void;
};

const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown']);

const extensionOf = ({ fileName }: { readonly fileName: string }): string => {
  const dot = fileName.lastIndexOf('.');
  if (dot < 0) {
    return '';
  }
  return fileName.slice(dot + 1).toLowerCase();
};

const mimeFromDataUrl = ({ url }: { readonly url: string }): string => {
  const match = /^data:([^;]+);base64,/.exec(url);
  if (match?.[1] == null) {
    return 'application/octet-stream';
  }
  return match[1];
};

const previewKindOf = ({
  entry,
  previewState,
}: {
  readonly entry: ExploreEntry;
  readonly previewState: PreviewState;
}): 'markdown' | 'text' | 'image' | 'pdf' | 'unsupported' => {
  if (previewState.status !== 'ready') {
    return 'unsupported';
  }
  if (previewState.content.type === 'text') {
    if (MARKDOWN_EXTENSIONS.has(extensionOf({ fileName: entry.name }))) {
      return 'markdown';
    }
    return 'text';
  }
  const mimeType = mimeFromDataUrl({ url: previewState.content.url });
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  if (mimeType === 'application/pdf') {
    return 'pdf';
  }
  return 'unsupported';
};

const formatByteSize = ({ bytes }: { readonly bytes: number }): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes / 1024;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  const precision = size >= 10 ? 0 : 1;
  return `${size.toFixed(precision)} ${units[index]}`;
};

export const ExplorePreviewPanel = ({
  entry,
  previewState,
  absolutePath,
  onClose,
  onOpenOutside,
}: Props) => {
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const previewKind = useMemo(() => previewKindOf({ entry, previewState }), [entry, previewState]);
  const modifiedLabel =
    entry.modifiedAt == null ? 'unknown age' : formatRelativeAge({ fromIso: entry.modifiedAt });
  const sizeLabel = formatByteSize({ bytes: entry.sizeBytes });
  const previewText =
    previewState.status === 'ready' && previewState.content.type === 'text'
      ? previewState.content.text
      : '';
  const isTruncated =
    previewState.status === 'ready' &&
    previewState.content.type === 'text' &&
    previewState.content.truncated;
  const pdfDataUrl =
    previewState.status === 'ready' &&
    previewState.content.type === 'dataUrl' &&
    previewKind === 'pdf'
      ? previewState.content.url
      : null;
  const renderPreviewBody = (): ReactNode => {
    if (previewState.status === 'loading') {
      return (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-3/4 rounded-md" />
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-11/12 rounded-md" />
          <Skeleton className="h-4 w-9/12 rounded-md" />
        </div>
      );
    }
    if (previewState.status === 'error') {
      return (
        <EmptyState
          icon={CONCEPT_ICONS.errors}
          tone={CONCEPT_TONE.errors}
          title="Could not read this file"
          description={previewState.message}
          size="inline"
        />
      );
    }
    if (previewKind === 'markdown') {
      return (
        <div className="flex flex-col gap-2">
          {isTruncated ? (
            <p className="text-xs text-muted-foreground">Preview is truncated to 256 KB.</p>
          ) : null}
          <Markdown text={previewText} className="text-sm text-foreground" />
        </div>
      );
    }
    if (previewKind === 'text') {
      return (
        <div className="flex flex-col gap-2">
          {isTruncated ? (
            <p className="text-xs text-muted-foreground">Preview is truncated to 256 KB.</p>
          ) : null}
          <pre className="whitespace-pre-wrap break-words rounded-md bg-subtle p-3 font-mono text-xs text-foreground">
            {previewText}
          </pre>
        </div>
      );
    }
    if (
      previewKind === 'image' &&
      previewState.status === 'ready' &&
      previewState.content.type === 'dataUrl'
    ) {
      return (
        <img
          src={previewState.content.url}
          alt={entry.name}
          className="max-h-[30rem] w-full rounded-md object-contain ring-1 ring-border-soft"
        />
      );
    }
    if (previewKind === 'pdf' && pdfDataUrl != null) {
      return (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">PDF previews open in a focused viewer.</p>
          <Button size="sm" variant="secondary" onClick={() => setPdfViewerOpen(true)}>
            Open PDF preview
          </Button>
          {pdfViewerOpen ? (
            <ImageLightbox
              media="pdf"
              src={pdfDataUrl}
              alt={entry.name}
              onClose={() => setPdfViewerOpen(false)}
            />
          ) : null}
        </div>
      );
    }
    return (
      <p className="text-xs text-muted-foreground">
        Preview is not available for this format. Open it in the app that owns it.
      </p>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <InspectorHeader
        title={entry.name}
        closeLabel={`close preview for ${entry.name}`}
        onClose={onClose}
      />
      <ScrollFade className="min-h-0 flex-1" viewportClassName={PANE_RHYTHM.rail.body}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <p className="truncate font-mono text-2xs">{entry.relPath}</p>
            <div className="flex flex-wrap items-center gap-2">
              <span>{sizeLabel}</span>
              <span>{modifiedLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={onOpenOutside}>
              <ExternalLink size={13} aria-hidden />
              Open outside
            </Button>
            <CopyButton value={absolutePath} label={`path for ${entry.name}`} />
          </div>
          <Divider />
          {renderPreviewBody()}
          {previewKind === 'unsupported' ? (
            <Button size="sm" variant="secondary" onClick={onOpenOutside}>
              Open this file outside the app
            </Button>
          ) : null}
        </div>
      </ScrollFade>
    </div>
  );
};
