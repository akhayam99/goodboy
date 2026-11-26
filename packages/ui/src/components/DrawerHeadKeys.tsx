import { ArrowUpRight } from '../icons';
import { ICON_SIZE } from '../iconSize';
import type { DrawerPage } from './DrawerFrame';
import { IconButton } from './IconButton';

const OPEN_FULL_PAGE = 'Open full page';

type Props = {
  readonly page: DrawerPage | undefined;
};

export const DrawerHeadKeys = ({ page }: Props) => {
  if (page === undefined) {
    return null;
  }
  const pageLabel = page.label ?? OPEN_FULL_PAGE;
  return (
    <IconButton
      icon={ArrowUpRight}
      label={pageLabel}
      tooltip={page.tooltip ?? pageLabel}
      variant="ghost"
      iconSize={ICON_SIZE.control}
      onClick={page.onOpen}
    />
  );
};
