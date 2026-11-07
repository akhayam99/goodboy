import { Compass } from 'lucide-react';
import { formatError, type MenuEntry, type MenuItemEntry } from '@goodboy/ui';
import { shortcutGlyphs } from '../../shared/keyboard/registry';
import type { ActionEnv, ActionPreviewParams, ActionSubmenu, ResolvedAction } from './types';

type Params = {
  readonly actions: ReadonlyArray<ResolvedAction>;
  readonly env: ActionEnv;
  readonly run: (params: {
    readonly actionId: string;
    readonly choice?: string | null;
  }) => Promise<void>;
  readonly onPreview?: (params: ActionPreviewParams) => void;
};

type ItemParams = Params & {
  readonly action: ResolvedAction;
};

const SUBMENUS = {
  goto: { label: 'Open', icon: Compass },
} as const satisfies Record<ActionSubmenu, Pick<MenuItemEntry, 'label' | 'icon'>>;

const guarded = async ({
  env,
  task,
}: {
  readonly env: ActionEnv;
  readonly task: () => Promise<void>;
}): Promise<void> => {
  try {
    await task();
  } catch (error) {
    env.showToast({ kind: 'warning', title: "Couldn't finish that", message: formatError(error) });
  }
};

const itemOf = ({ action, actions, env, run, onPreview }: ItemParams): MenuItemEntry => {
  const alt =
    action.confirm?.altActionId === undefined
      ? undefined
      : actions.find((candidate) => candidate.id === action.confirm?.altActionId);
  return {
    kind: 'item',
    key: action.id,
    label: action.label,
    ariaLabel: action.ariaLabel,
    icon: action.icon,
    iconClassName: action.iconClassName,
    hint: action.shortcut === null ? null : shortcutGlyphs(action.shortcut),
    description: action.description,
    blockedReason: action.blockedReason,
    isDestructive: action.confirm?.role === 'danger',
    choices: action.choices,
    ...(onPreview !== undefined &&
      action.preview !== null && {
        onActive: () => onPreview({ preview: action.preview }),
        onInactive: () => onPreview({ preview: null }),
      }),
    confirm:
      action.confirm === null
        ? null
        : {
            title: action.confirm.title,
            description: action.confirm.description,
            confirmLabel: action.confirm.confirmLabel,
            role: action.confirm.role,
            ...(action.confirm.notes !== undefined && { notes: action.confirm.notes }),
            ...(alt !== undefined && {
              alt: {
                label: action.confirm.altLabel ?? `${alt.label} instead`,
                onSelect: () => guarded({ env, task: () => run({ actionId: alt.id }) }),
              },
            }),
          },
    onSelect: (choice) => guarded({ env, task: () => run({ actionId: action.id, choice }) }),
  };
};

export const toMenuEntries = ({
  actions,
  env,
  run,
  onPreview,
}: Params): ReadonlyArray<MenuEntry> => {
  const shared = { actions, env, run, onPreview };
  return actions.flatMap((action, index): ReadonlyArray<MenuEntry> => {
    const previous = actions[index - 1];
    if (action.submenu !== undefined && previous?.submenu === action.submenu) {
      return [];
    }
    const separator: ReadonlyArray<MenuEntry> =
      previous !== undefined && previous.group !== action.group
        ? [{ kind: 'separator', key: `separator-${action.id}` }]
        : [];
    if (action.submenu === undefined) {
      return [...separator, itemOf({ ...shared, action })];
    }
    const members: Array<ResolvedAction> = [];
    for (const candidate of actions.slice(index)) {
      if (candidate.submenu !== action.submenu) {
        break;
      }
      members.push(candidate);
    }
    const { label, icon } = SUBMENUS[action.submenu];
    return [
      ...separator,
      {
        kind: 'item',
        key: `submenu-${action.submenu}`,
        label,
        icon,
        children: members.map((member) => itemOf({ ...shared, action: member })),
        onSelect: () => undefined,
      },
    ];
  });
};
