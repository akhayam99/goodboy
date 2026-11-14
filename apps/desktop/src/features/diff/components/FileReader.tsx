import { useState } from 'react';
import { Button, Notice, PageColumn, Skeleton } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { SourceView } from '../../../shared/components/SourceView';
import type { ExploreEntry } from '../../explore/explore';
import { useExploreOpen } from '../FilesMode/useExploreOpen';
import type { ExploreOpenFailure } from '../../explore/openFailure';
import { useExplorePreview } from '../FilesMode/useExplorePreview';
import { lineCountOf } from '../lib/lineCountOf';

type Props = {
  readonly sessionId: SessionId;
  readonly sessionDir: string;
  readonly entry: ExploreEntry;
  readonly baseBranch: string;
  readonly onBack: () => void;
};

export const FileReader = ({ sessionId, sessionDir, entry, baseBranch, onBack }: Props) => {
  const preview = useExplorePreview({ sessionDir, entry });
  const open = useExploreOpen({ sessionId, sessionDir });
  const [failure, setFailure] = useState<ExploreOpenFailure | null>(null);
  const canOpen = open.canOpen({ entry });
  const lineCount =
    preview.status === 'ready' && preview.content.type === 'text'
      ? lineCountOf({ text: preview.content.text })
      : null;

  const renderBody = () => {
    if (preview.status === 'loading') {
      return (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-3/4 rounded-md" />
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-11/12 rounded-md" />
          <Skeleton className="h-4 w-9/12 rounded-md" />
        </div>
      );
    }
    if (preview.status === 'error') {
      return (
        <Notice
          tone="danger"
          placement="inline"
          role="alert"
          title="Couldn't read this file"
          detail={preview.message}
          actions={
            <Button size="sm" variant="secondary" onClick={preview.retry}>
              Retry
            </Button>
          }
        />
      );
    }
    const { content } = preview;
    if (content.type === 'text') {
      return (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {content.truncated ? (
            <p className="text-meta text-muted-foreground">Preview is truncated to 256 KB.</p>
          ) : null}
          <SourceView text={content.text} path={entry.name} isWrapped={false} />
        </div>
      );
    }
    if (content.type === 'dataUrl' && content.url.startsWith('data:image/')) {
      return (
        <img
          src={content.url}
          alt={entry.name}
          className="max-h-[30rem] w-full rounded-md object-contain ring-1 ring-border-soft"
        />
      );
    }
    return (
      <p className="text-meta text-muted-foreground">
        This file is binary. Open it in the app that owns it.
      </p>
    );
  };

  return (
    <div data-slot="file-reader" className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <PageColumn className="flex min-w-0 flex-col gap-3">
        <div>
          <Button size="sm" variant="quiet" onClick={onBack}>
            Back to the changes
          </Button>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-body text-foreground">{entry.relPath}</span>
            <span className="text-meta tabular-nums text-muted-foreground">
              Unchanged against {baseBranch}
              {lineCount === null ? '' : ` · ${lineCount} lines`}
            </span>
          </div>
          {canOpen ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void open.run({ entry, isReveal: false }).then(setFailure);
              }}
            >
              {open.actionOf({ entry }).label}
            </Button>
          ) : null}
        </div>
        {failure === null ? null : (
          <p role="alert" className="text-meta text-danger">
            {failure.message}
          </p>
        )}
      </PageColumn>
      <PageColumn className="flex min-h-0 min-w-0 flex-1 flex-col">{renderBody()}</PageColumn>
    </div>
  );
};
