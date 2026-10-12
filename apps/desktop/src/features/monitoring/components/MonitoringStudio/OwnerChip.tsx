import { Chip, Tooltip } from '@goodboy/ui';
import type { PortOwner } from '@goodboy/core';
import { sessionPlace, useAppStore } from '../../../../store';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import { ownerPresentation } from '../../ownerPresentation';

type Props = {
  readonly owner: PortOwner;
};

export const OwnerChip = ({ owner }: Props) => {
  const projects = useAppStore((state) => state.projects);
  const sessionMounts = useAppStore((state) => state.sessionMounts);
  const navigate = useAppStore((state) => state.navigate);
  const presentation = ownerPresentation({ owner, projects, sessionMounts });
  const session = useAppStore((state) =>
    presentation.sessionId === null
      ? undefined
      : sessionById(state.sessions, presentation.sessionId),
  );

  const anchor = 'min-w-0 max-w-full';
  const label = <span className="min-w-0 truncate">{presentation.label}</span>;

  if (!presentation.isGoodboy) {
    return (
      <Tooltip content={presentation.label} anchorClassName={anchor}>
        <span className="min-w-0 max-w-full truncate text-meta text-faint-foreground">
          {presentation.label}
        </span>
      </Tooltip>
    );
  }
  if (session === undefined) {
    return (
      <Tooltip content={presentation.label} anchorClassName={anchor}>
        <Chip
          tone="neutral"
          kind="reference"
          size="xs"
          label={label}
          className="min-w-0 max-w-full"
        />
      </Tooltip>
    );
  }
  return (
    <Tooltip content={presentation.label} anchorClassName={anchor}>
      <Chip
        tone="neutral"
        kind="reference"
        size="xs"
        as="button"
        label={label}
        ariaLabel={`Open session: ${presentation.label}`}
        className="min-w-0 max-w-full"
        onClick={() => navigate({ to: sessionPlace({ sessionId: session.id }) })}
      />
    </Tooltip>
  );
};
