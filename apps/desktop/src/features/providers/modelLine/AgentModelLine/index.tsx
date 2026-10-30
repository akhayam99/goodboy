import { Tooltip, cn } from '@goodboy/ui';
import type { ModelLine } from '../modelLineOf';
import { ProviderIcon } from '../../components/ProviderIcon';

type Props = {
  readonly line: ModelLine | null;
  readonly className?: string;
};

export const AgentModelLine = ({ line, className }: Props) => {
  if (line === null) {
    return null;
  }
  const body = (
    <span
      data-model-line=""
      data-unknown={line.isUnknown ? '' : undefined}
      className={cn(
        'inline-flex min-w-0 items-center gap-1 text-meta text-muted-foreground',
        className,
      )}
    >
      {line.provider === null ? null : (
        <span aria-hidden className="inline-flex shrink-0 items-center opacity-75">
          <ProviderIcon provider={line.provider} variant="glyph" />
        </span>
      )}
      <span data-model-part="name" className="min-w-0 truncate">
        {line.name}
      </span>
      {line.effort === null ? null : (
        <>
          {' '}
          <span data-model-part="effort" className="shrink-0 text-faint-foreground">
            {line.effort}
          </span>
        </>
      )}
    </span>
  );
  if (line.rawId === null) {
    return body;
  }
  return <Tooltip content={line.rawId}>{body}</Tooltip>;
};
