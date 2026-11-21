import { MenuChoicePanel } from './MenuChoicePanel';
import { MenuSubmenuPanel } from './MenuSubmenuPanel';
import type { MenuItemEntry } from './menuTypes';

type Opened = {
  readonly key: string;
  readonly anchor: HTMLElement;
};

export type Expanded = Opened & {
  readonly child: Opened | null;
};

type SelectParams = {
  readonly entry: MenuItemEntry;
  readonly choice: string | null;
};

type Props = {
  readonly expanded: Expanded;
  readonly entry: MenuItemEntry;
  readonly onSelect: (params: SelectParams) => void;
  readonly onOpenChild: (child: Opened) => void;
  readonly onCloseChild: () => void;
  readonly onBack: () => void;
  readonly onClose: () => void;
};

export const MenuExpandedPanels = ({
  expanded,
  entry,
  onSelect,
  onOpenChild,
  onCloseChild,
  onBack,
  onClose,
}: Props) => {
  const childChoices = expanded.child;
  const child =
    childChoices === null
      ? null
      : (entry.children?.find((candidate) => candidate.key === childChoices.key) ?? null);
  return (
    <>
      {entry.children != null ? (
        <MenuSubmenuPanel
          label={entry.label}
          items={entry.children}
          anchor={expanded.anchor}
          expandedKey={childChoices?.key ?? null}
          onChoose={({ entry: chosen, anchor }) => {
            if (chosen.choices != null && chosen.choices.length > 0) {
              onOpenChild({ key: chosen.key, anchor });
              return;
            }
            onSelect({ entry: chosen, choice: null });
          }}
          onBack={onBack}
        />
      ) : null}
      {childChoices !== null && child?.choices != null ? (
        <MenuChoicePanel
          label={child.label}
          choices={child.choices}
          anchor={childChoices.anchor}
          onChoose={(choice) => onSelect({ entry: child, choice })}
          onBack={onCloseChild}
          onClose={onClose}
        />
      ) : null}
      {entry.choices != null ? (
        <MenuChoicePanel
          label={entry.label}
          choices={entry.choices}
          anchor={expanded.anchor}
          onChoose={(choice) => onSelect({ entry, choice })}
          onBack={onBack}
          onClose={onClose}
        />
      ) : null}
    </>
  );
};
