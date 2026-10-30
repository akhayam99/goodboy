import { formatError, type MenuEntry } from '@goodboy/ui';
import { shortcutGlyphs } from '../../shared/keyboard/registry';
import type { ActionEnv, ActionPreviewParams, ResolvedAction } from './types';

type Params = {
  readonly actions: ReadonlyArray<ResolvedAction>;
  readonly env: ActionEnv;
  readonly run: (params: {
    readonly actionId: string;
    readonly choice?: string | null;
  }) => Promise<void>;
  readonly onPreview?: (params: ActionPreviewParams) => void;
};

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

export const toMenuEntries = ({ actions, env, run, onPreview }: Params): ReadonlyArray<MenuEntry> =>
  actions.flatMap((action, index): ReadonlyArray<MenuEntry> => {
    const previous = actions[index - 1];
    const separator: ReadonlyArray<MenuEntry> =
      previous !== undefined && previous.group !== action.group
        ? [{ kind: 'separator', key: `separator-${action.id}` }]
        : [];
    const alt =
      action.confirm?.altActionId === undefined
        ? undefined
        : actions.find((candidate) => candidate.id === action.confirm?.altActionId);
    return [
      ...separator,
      {
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
      },
    ];
  });
