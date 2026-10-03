import { Button } from '@goodboy/ui';
import type { SessionExternalTaskProvider } from '@goodboy/types';
import { TaskLinkChip } from '../../../../shared/components/TaskLinkChip';
import { SCOPE_TAB_LABEL, linkedLabel, type LinkScope } from './linkScope';

type Props = {
  readonly provider: SessionExternalTaskProvider;
  readonly identifier: string;
  readonly title: string;
  readonly scope: LinkScope;
  readonly branch: string | null;
  readonly isClosing: boolean;
  readonly isLinking: boolean;
  readonly duplicate?: {
    readonly scopes: ReadonlyArray<LinkScope>;
    readonly next: LinkScope | null;
  };
  readonly onToggleClosing: () => void;
  readonly onLink: () => void;
  readonly onCancel: () => void;
};

const placeOf = ({ scope, branch }: Pick<Props, 'scope' | 'branch'>): string => {
  if (scope === 'workspace') {
    return 'on the Board';
  }
  if (scope === 'branch') {
    return `on ${branch ?? 'this branch'}`;
  }
  return 'on this session';
};

export const LinkScopePreview = ({
  provider,
  identifier,
  title,
  scope,
  branch,
  isClosing,
  isLinking,
  duplicate,
  onToggleClosing,
  onLink,
  onCancel,
}: Props) => (
  <div aria-label="Link preview" className="flex flex-col gap-2 px-3 py-2.5">
    <div className="flex min-w-0 items-center gap-2">
      <TaskLinkChip
        provider={provider}
        identifier={identifier}
        isOnBranch={scope === 'branch'}
        {...(scope === 'workspace' ? { title } : {})}
      />
      <span className="truncate text-label text-muted-foreground">
        {placeOf({ scope, branch })}
      </span>
    </div>
    <p className="text-label text-foreground">
      {duplicate !== undefined ? (
        `${linkedLabel({ scopes: duplicate.scopes })} already.${duplicate.next === null ? '' : ` Pick ${SCOPE_TAB_LABEL[duplicate.next]} to add it there too.`}`
      ) : scope === 'workspace' ? (
        'Stays open. Shows under Ongoing on the Board, not on this session.'
      ) : isClosing ? (
        <>
          {`Will close ${identifier} when merged · `}
          <button
            type="button"
            onClick={onToggleClosing}
            className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            Don’t close
          </button>
        </>
      ) : (
        <>
          {`Part of ${identifier}. It stays open when merged. `}
          <button
            type="button"
            onClick={onToggleClosing}
            className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            Close it instead
          </button>
        </>
      )}
    </p>
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="primary"
        disabled={isLinking || duplicate !== undefined}
        onClick={onLink}
      >
        {`Link ${identifier}`}
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  </div>
);
