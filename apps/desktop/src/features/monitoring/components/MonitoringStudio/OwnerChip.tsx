import { Chip } from '@goodboy/ui';
import type { PortOwner } from '@goodboy/core';
import { sessionPlace, useAppStore } from '../../../../store';
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
      : state.sessions.find((item) => item.id === presentation.sessionId),
  );

  if (!presentation.isGoodboy) {
    return (
      <span className="min-w-0 truncate text-meta text-faint-foreground">{presentation.label}</span>
    );
  }
  if (session === undefined) {
    return <Chip tone="neutral" kind="reference" size="xs" label={presentation.label} />;
  }
  return (
    <Chip
      tone="neutral"
      kind="reference"
      size="xs"
      as="button"
      label={presentation.label}
      ariaLabel={`Open session: ${presentation.label}`}
      onClick={() => navigate({ to: sessionPlace({ sessionId: session.id }) })}
    />
  );
};
