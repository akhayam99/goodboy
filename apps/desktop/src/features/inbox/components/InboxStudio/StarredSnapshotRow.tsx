import { AlertTriangle } from 'lucide-react';
import type { StarredIssue } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { StarToggle } from '../../../../shared/components/StarToggle';
import { openUrl } from '../../../../shared/lib/editor';
import { IntegrationGlyph } from '../../../integrations/components/IntegrationGlyph';

type Props = {
  readonly issue: StarredIssue;
  readonly onUnstar: () => void;
};

export const StarredSnapshotRow = ({ issue, onUnstar }: Props) => {
  const isMissing = issue.state === 'missing';
  return (
    <div className="group grid h-8 grid-cols-[6px_14px_76px_minmax(0,1fr)_auto_48px] items-center gap-2.5 rounded-md px-2.5 text-muted-foreground hover:bg-hover">
      <span />
      <IntegrationGlyph provider={issue.provider} size="xs" useBrandColor />
      <span className="truncate font-mono text-secondary tabular-nums text-faint-foreground">
        {issue.identifier}
      </span>
      <button
        type="button"
        disabled={issue.url === ''}
        onClick={() => void openUrl(issue.url)}
        className={cn(
          'truncate text-left text-label',
          issue.state === 'done' ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {issue.title}
      </button>
      <span className="flex items-center gap-1 text-secondary">
        {isMissing ? (
          <>
            <AlertTriangle size={ICON_SIZE.control} aria-hidden className="text-warning" />
            {`Can't reach ${issue.identifier} anymore`}
          </>
        ) : (
          (issue.stateLabel ?? '')
        )}
      </span>
      <span className="flex justify-end">
        <StarToggle
          isStarred
          label={`Star ${issue.identifier}`}
          tooltip="Unstar"
          onToggle={onUnstar}
          className="size-5"
        />
      </span>
    </div>
  );
};
