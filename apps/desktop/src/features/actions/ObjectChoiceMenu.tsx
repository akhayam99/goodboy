import { useMemo, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import {
  AnchoredPopover,
  MenuList,
  MenuTriggerButton,
  useDropdown,
  type MenuEntry,
} from '@goodboy/ui';
import { useActionEnv } from './useActionEnv';
import { useObjectActions } from './useObjectActions';
import { toMenuEntries } from './toMenuEntries';
import type { ObjectTarget } from './types';

const MIN_DRAWN_CHOICES = 2;

type Props = {
  readonly target: ObjectTarget;
  readonly actionId: string;
  readonly label: string;
  readonly tooltip: string;
  readonly children: ReactNode;
  readonly fallback: ReactNode;
  readonly leadingCurrent?: string;
  readonly triggerClassName?: string;
  readonly anchorClassName?: string;
};

export const ObjectChoiceMenu = ({
  target,
  actionId,
  label,
  tooltip,
  children,
  fallback,
  leadingCurrent,
  triggerClassName,
  anchorClassName,
}: Props) => {
  const env = useActionEnv({ origin: 'overflow' });
  const { actions, run } = useObjectActions({ target, env });
  const dropdown = useDropdown({
    align: 'start',
    width: 'min-w-[240px] max-w-sm',
    expectedHeight: 280,
    expectedWidth: 280,
  });
  const { close } = dropdown;
  const entries = useMemo((): ReadonlyArray<MenuEntry> => {
    const action = actions.find((candidate) => candidate.id === actionId);
    if (action === undefined) {
      return [];
    }
    const source = toMenuEntries({ actions: [action], env, run }).find(
      (entry) => entry.kind === 'item' && entry.key === actionId,
    );
    if (source === undefined || source.kind !== 'item') {
      return [];
    }
    const choices = source.choices ?? [];
    const leading: ReadonlyArray<MenuEntry> =
      leadingCurrent === undefined || choices.some((choice) => choice.label === leadingCurrent)
        ? []
        : [
            {
              kind: 'item',
              key: `${actionId}:leading`,
              label: leadingCurrent,
              icon: Check,
              onSelect: () => undefined,
            },
          ];
    return [
      { kind: 'header', key: 'title', label: tooltip },
      ...leading,
      ...choices.map((choice): MenuEntry => ({
        kind: 'item',
        key: choice.id,
        label: choice.label,
        ...(choice.isCurrent ? { icon: Check } : {}),
        onSelect: () => (choice.isCurrent ? undefined : source.onSelect(choice.id)),
      })),
    ];
  }, [actions, actionId, env, tooltip, leadingCurrent, run]);
  const drawn = entries.filter((entry) => entry.kind === 'item').length;
  if (drawn < MIN_DRAWN_CHOICES) {
    return <>{fallback}</>;
  }
  return (
    <AnchoredPopover
      dropdown={dropdown}
      anchorClassName={anchorClassName}
      trigger={
        <MenuTriggerButton
          label={label}
          tooltip={tooltip}
          isOpen={dropdown.open}
          onClick={dropdown.toggle}
          className={triggerClassName}
        >
          {children}
        </MenuTriggerButton>
      }
    >
      <MenuList label={tooltip} entries={entries} onClose={close} />
    </AnchoredPopover>
  );
};
