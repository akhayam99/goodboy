import { AlertTriangle, ArrowUpRight } from 'lucide-react';
import type { StarredIssue } from '@goodboy/types';
import { FOCUS_RING, Tooltip, cn, StarToggle } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { openUrl } from '../../../../shared/lib/editor';
import {
  IntegrationGlyph,
  integrationLabel,
} from '../../../integrations/components/IntegrationGlyph';

type Props = {
  readonly issue: StarredIssue;
  readonly recordKey: string;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly onUnstar: () => void;
};

export const StarredSnapshotRow = ({ issue, recordKey, selected, onSelect, onUnstar }: Props) => {
  const isMissing = issue.state === 'missing';
  const toolLabel = integrationLabel({ provider: issue.provider });
  const canOpen = issue.url !== '';
  return (
    <div
      data-inbox-key={recordKey}
      data-selected={selected}
      className={cn(
        'group relative grid h-8 grid-cols-[6px_14px_76px_minmax(0,1fr)_auto_48px] items-center gap-3 rounded-md px-3 text-muted-foreground motion-safe:transition-colors',
        selected ? 'bg-selected text-foreground' : 'hover:bg-hover hover:text-foreground',
      )}
    >
      <button
        type="button"
        tabIndex={-1}
        title={issue.title}
        onClick={onSelect}
        className={cn('absolute inset-0 cursor-pointer rounded-md', FOCUS_RING)}
      >
        <span className="sr-only">{`${issue.identifier} ${issue.title}`}</span>
      </button>
      <span />
      <span aria-hidden className="pointer-events-none relative flex">
        <IntegrationGlyph provider={issue.provider} size="xs" useBrandColor />
      </span>
      <span className="pointer-events-none relative truncate font-mono text-meta tabular-nums text-faint-foreground">
        {issue.identifier}
      </span>
      <span
        className={cn(
          'pointer-events-none relative truncate text-left text-label',
          issue.state === 'done' ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {issue.title}
      </span>
      <span className="pointer-events-none relative flex items-center gap-1 text-meta">
        {isMissing ? (
          <>
            <AlertTriangle size={ICON_SIZE.control} aria-hidden className="text-warning" />
            {`Can't reach ${issue.identifier} anymore`}
          </>
        ) : (
          (issue.stateLabel ?? '')
        )}
      </span>
      <span className="relative flex h-5 items-center justify-end gap-0.5">
        <StarToggle
          isStarred
          label={`Star ${issue.identifier}`}
          tooltip="Unstar"
          onToggle={onUnstar}
          className="size-5"
        />
        {canOpen ? (
          <Tooltip content={`Open in ${toolLabel}`}>
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              title={`Open ${issue.identifier} in ${toolLabel}`}
              onClick={() => void openUrl(issue.url)}
              className={cn(
                'relative size-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-hover hover:text-foreground',
                selected ? 'flex' : 'hidden group-hover:flex',
                FOCUS_RING,
              )}
            >
              <ArrowUpRight size={ICON_SIZE.row} aria-hidden />
            </button>
          </Tooltip>
        ) : null}
      </span>
    </div>
  );
};
