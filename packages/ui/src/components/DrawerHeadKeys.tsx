import { useContext } from 'react';
import { DockPairTurnContext } from '../dockPairTurnContext';
import { ArrowUpRight } from '../icons';
import { ICON_SIZE } from '../iconSize';
import type { DrawerPage } from './DrawerFrame';
import { IconButton } from './IconButton';

type Props = {
  readonly page: DrawerPage | undefined;
};

export const DrawerHeadKeys = ({ page }: Props) => {
  const pairTurn = useContext(DockPairTurnContext);
  return (
    <>
      {pairTurn === null ? null : (
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
          label={page.label ?? 'Open page'}
          tooltip={page.tooltip ?? page.label ?? 'Open page'}
          variant="ghost"
          iconSize={ICON_SIZE.control}
          onClick={page.onOpen}
        />
      )}
    </>
  );
};
