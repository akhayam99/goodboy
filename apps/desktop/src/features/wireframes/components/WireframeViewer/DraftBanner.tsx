import { useState } from 'react';
import { Button, Notice } from '@goodboy/ui';
import type { WireframeDraft } from '../../wireframeDraft';

type Props = {
  readonly draft: Exclude<WireframeDraft, Readonly<{ status: 'drafting' }>>;
  readonly currentRevision: number;
  readonly changeCount: number | null;
  readonly onCompare: () => void;
  readonly onAskAgain: () => void;
  readonly onDismiss: () => void;
};

export const DraftBanner = ({
  draft,
  currentRevision,
  changeCount,
  onCompare,
  onAskAgain,
  onDismiss,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  if (draft.status === 'ready') {
    return (
      <Notice
        tone="success"
        placement="inline"
        role="status"
        title={`v${draft.toRevision} is ready.`}
        actions={
          <span className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onCompare}
              data-testid="wireframe-ready-compare"
            >
              {changeCount === null
                ? 'Compare'
                : `${changeCount} ${changeCount === 1 ? 'change' : 'changes'} · Compare`}
            </Button>
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              Dismiss
            </Button>
          </span>
        }
      />
    );
  }
  return (
    <Notice
      tone="warning"
      placement="inline"
      role="alert"
      title={`v${draft.fromRevision + 1} was not kept. ${draft.reason} You are still on v${currentRevision}.`}
      {...(isOpen && draft.detail !== null ? { body: draft.detail } : {})}
      actions={
        <span className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onAskAgain}>
            Ask again
          </Button>
          {draft.detail === null ? null : (
            <Button variant="ghost" size="sm" onClick={() => setIsOpen((value) => !value)}>
              {isOpen ? 'Hide details' : 'Show details'}
            </Button>
          )}
        </span>
      }
    />
  );
};
