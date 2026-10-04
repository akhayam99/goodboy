import { Button } from '@goodboy/ui';
import type { SessionExternalTaskProvider } from '@goodboy/types';
import { TaskLinkChip } from '../../../../shared/components/TaskLinkChip';
import { linkedLabel, type LinkScope } from './linkScope';

type Props = {
  readonly provider: SessionExternalTaskProvider;
  readonly identifier: string;
  readonly title: string;
  readonly scope: LinkScope;
  readonly isClosing: boolean;
  readonly isLinking: boolean;
  readonly duplicate?: {
    readonly scopes: ReadonlyArray<LinkScope>;
  };
  readonly onToggleClosing: () => void;
  readonly onLink: () => void;
  readonly onCancel: () => void;
};

const placeOf = ({ scope }: Pick<Props, 'scope'>): string =>
  scope === 'workspace' ? 'on the Board' : 'not on a branch yet';

export const LinkScopePreview = ({
  provider,
  identifier,
  title,
  scope,
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
        {...(scope === 'workspace' ? { title } : {})}
      />
      <span className="truncate text-label text-muted-foreground">{placeOf({ scope })}</span>
    </div>
    <p className="text-label text-foreground">
      {duplicate !== undefined ? (
        `${linkedLabel({ scopes: duplicate.scopes })} already.`
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
