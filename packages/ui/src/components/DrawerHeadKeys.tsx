import { useContext } from 'react';
import { DockPairTurnContext } from '../dockPairTurnContext';
import { ArrowUpRight } from '../icons';
import { ICON_SIZE } from '../iconSize';
import type { MenuItemEntry } from './ContextMenu/menuTypes';
import type { DrawerPage } from './DrawerFrame';
import { IconButton } from './IconButton';
import { OverflowMenu } from './OverflowMenu';

const OPEN_FULL_PAGE = 'Open full page';

type Props = {
  readonly page: DrawerPage | undefined;
  readonly title: string;
  readonly isFolded: boolean;
  readonly hasMenu: boolean;
};

export const DrawerHeadKeys = ({ page, title, isFolded, hasMenu }: Props) => {
  const pairTurn = useContext(DockPairTurnContext);
  const pageLabel = page?.label ?? OPEN_FULL_PAGE;
  const entries: ReadonlyArray<MenuItemEntry> = [
    ...(pairTurn === null
      ? []
      : [
          {
            kind: 'item' as const,
            key: 'turn',
            label: pairTurn.label,
            icon: pairTurn.icon,
            onSelect: pairTurn.onTurn,
          },
        ]),
    ...(page === undefined
      ? []
      : [
          {
            kind: 'item' as const,
            key: 'page',
            label: pageLabel,
            icon: ArrowUpRight,
            onSelect: page.onOpen,
          },
        ]),
  ];
  if (isFolded && !hasMenu && entries.length > 1) {
    return <OverflowMenu entries={entries} label={`More on ${title}`} size="control" />;
  }
  const isTurnShown = pairTurn !== null && !(isFolded && hasMenu);
  return (
    <>
      {pairTurn === null || !isTurnShown ? null : (
        <IconButton
          icon={pairTurn.icon}
          label={pairTurn.label}
          tooltip={pairTurn.label}
          variant="ghost"
          iconSize={ICON_SIZE.control}
          onClick={pairTurn.onTurn}
        />
      )}
      {page === undefined ? null : (
        <IconButton
          icon={ArrowUpRight}
          label={pageLabel}
          tooltip={page.tooltip ?? pageLabel}
          variant="ghost"
          iconSize={ICON_SIZE.control}
          onClick={page.onOpen}
        />
      )}
    </>
  );
};
