import { useCallback } from 'react';
import { OverflowMenu, type OverflowMenuItem } from '@goodboy/ui';
import type { SuggestionActionChoice } from '../../useSuggestionActions';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { agentKindPalette, type AgentKind } from '../../../session/agent-kind';
import { NEXT_STEP_CELLS } from './nextStepGrid';

const MIN_MENU_ITEMS = 2;

export const TALK_IT_THROUGH_LABEL = 'Talk it through with Auto';

type Props = {
  readonly title: string;
  readonly choices: ReadonlyArray<SuggestionActionChoice>;
  readonly pendingChoiceIds: ReadonlySet<string>;
  readonly isHeld: boolean;
  readonly isDisabled: boolean;
  readonly onPreview: (kind: AgentKind | null) => void;
  readonly onTalk?: () => void;
};

export const NextStepMenu = ({
  title,
  choices,
  pendingChoiceIds,
  isHeld,
  isDisabled,
  onPreview,
  onTalk,
}: Props) => {
  const onOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        onPreview(null);
      }
    },
    [onPreview],
  );

  const entryCount = choices.length + (onTalk === undefined ? 0 : 1);
  if (entryCount < MIN_MENU_ITEMS) {
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

  const talkItems: ReadonlyArray<OverflowMenuItem> =
    onTalk === undefined
      ? []
      : [
          {
            kind: 'item',
            key: 'talk-it-through-with-auto',
            label: TALK_IT_THROUGH_LABEL,
            icon: CONCEPT_ICONS.auto,
            iconClassName: agentKindPalette({ kind: 'auto' }).fg,
            disabled: isDisabled,
            onClick: onTalk,
          },
        ];

  return (
    <span data-column="menu" className={NEXT_STEP_CELLS.menu}>
      <OverflowMenu
        items={[...items, ...talkItems]}
        label={`More options for ${title}`}
        size="control"
        disabled={isDisabled}
        onOpenChange={onOpenChange}
      />
    </span>
  );
};
