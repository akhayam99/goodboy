import type { ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button, OverflowMenu, type OverflowMenuItem } from '@goodboy/ui';
import type { ArtifactActionId, ArtifactActionSet } from './artifactActions';
import { ARTIFACT_ACTION_PRESENTATION } from './artifactActionPresentation';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

export type ArtifactActionHandle = Readonly<{
  onClick: () => void;
  label?: string;
  hint?: string;
  isDisabled?: boolean;
  isBusy?: boolean;
}>;

export type ArtifactActionHandles = Readonly<
  Partial<Record<ArtifactActionId, ArtifactActionHandle>>
>;

type Props = {
  readonly set: ArtifactActionSet;
  readonly handles: ArtifactActionHandles;
  readonly renderSecondary?: (id: ArtifactActionId) => ReactNode | null;
};

type ButtonParams = {
  readonly id: ArtifactActionId;
  readonly handle: ArtifactActionHandle;
  readonly variant: 'primary' | 'secondary';
};

const actionButton = ({ id, handle, variant }: ButtonParams) => {
  const presentation = ARTIFACT_ACTION_PRESENTATION[id];
  const Icon = presentation.icon;
  return (
    <Button
      key={id}
      variant={variant}
      size="sm"
      onClick={handle.onClick}
      disabled={handle.isDisabled === true}
      isBusy={handle.isBusy === true}
      title={handle.hint}
      data-testid={`artifact-action-${id}`}
    >
      <Icon size={ICON_SIZE.row} aria-hidden />
      {handle.label ?? presentation.label}
    </Button>
  );
};

const overflowItem = ({
  id,
  handle,
}: {
  readonly id: ArtifactActionId;
  readonly handle: ArtifactActionHandle;
}): OverflowMenuItem => {
  const presentation = ARTIFACT_ACTION_PRESENTATION[id];
  const description =
    handle.hint ?? ('description' in presentation ? presentation.description : undefined);
  return {
    kind: 'item',
    key: id,
    label: handle.label ?? presentation.label,
    icon: presentation.icon,
    onClick: handle.onClick,
    ...(description === undefined ? {} : { description }),
    ...(handle.isDisabled === true && { disabled: true }),
    ...(id === 'discard' && { destructive: true }),
  };
};

export const ArtifactShellActions = ({ set, handles, renderSecondary }: Props) => {
  const secondary = set.secondary;
  const secondaryHandle = secondary === null ? undefined : handles[secondary];
  const custom =
    secondary === null || renderSecondary === undefined ? null : renderSecondary(secondary);
  const primaryHandle = set.primary === null ? undefined : handles[set.primary];
  const overflow = set.overflow.flatMap((id) => {
    const handle = handles[id];
    return handle === undefined ? [] : [overflowItem({ id, handle })];
  });

  return (
    <span data-testid="artifact-actions" className="flex min-w-0 shrink-0 items-center gap-1.5">
      {custom}
      {custom === null && secondary !== null && secondaryHandle !== undefined
        ? actionButton({ id: secondary, handle: secondaryHandle, variant: 'secondary' })
        : null}
      {set.primary !== null && primaryHandle !== undefined
        ? actionButton({ id: set.primary, handle: primaryHandle, variant: 'primary' })
        : null}
      {overflow.length === 0 ? null : (
        <OverflowMenu
          items={overflow}
          label="More"
          tooltip="More actions"
          trigger={<MoreHorizontal size={ICON_SIZE.control} aria-hidden />}
          triggerClassName="p-1.5"
        />
      )}
    </span>
  );
};
