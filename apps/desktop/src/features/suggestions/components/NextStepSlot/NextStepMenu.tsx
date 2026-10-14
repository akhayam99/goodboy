import { useCallback } from 'react';
import { OverflowMenu, type OverflowMenuItem } from '@goodboy/ui';
import type { SuggestionActionChoice } from '../../useSuggestionActions';
import { agentKindPalette, type AgentKind } from '../../../session/agent-kind';
import { NEXT_STEP_CELLS } from './nextStepGrid';

const MIN_MENU_ITEMS = 2;

type Props = {
  readonly title: string;
  readonly choices: ReadonlyArray<SuggestionActionChoice>;
  readonly pendingChoiceIds: ReadonlySet<string>;
  readonly isHeld: boolean;
  readonly isDisabled: boolean;
  readonly onPreview: (kind: AgentKind | null) => void;
};

export const NextStepMenu = ({
  title,
  choices,
  pendingChoiceIds,
  isHeld,
  isDisabled,
  onPreview,
}: Props) => {
  const onOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        onPreview(null);
      }
    },
    [onPreview],
  );

  if (choices.length < MIN_MENU_ITEMS) {
    return <span aria-hidden data-column="menu" className={NEXT_STEP_CELLS.menu} />;
  }

  const items = choices.map((choice): OverflowMenuItem => {
    const kind = choice.agentKind ?? null;
    const palette = kind === null ? null : agentKindPalette({ kind });
    const hint = [choice.description, choice.detail].filter((part) => part !== '').join(', ');
    return {
      kind: 'item',
      key: choice.id,
      label: choice.label,
      ...(hint !== '' && { description: hint }),
      ...(palette !== null && { icon: palette.icon, iconClassName: palette.fg }),
      disabled: isHeld && !pendingChoiceIds.has(choice.id),
      onActive: () => onPreview(kind),
      onInactive: () => onPreview(null),
      onClick: () => {
        void choice.run();
      },
    };
  });

  return (
    <span data-column="menu" className={NEXT_STEP_CELLS.menu}>
      <OverflowMenu
        items={items}
        label={`More options for ${title}`}
        size="control"
        disabled={isDisabled}
        onOpenChange={onOpenChange}
      />
    </span>
  );
};
