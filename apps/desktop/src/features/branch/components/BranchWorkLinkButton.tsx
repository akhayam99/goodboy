import { Button } from '@goodboy/ui';
import type { BranchWorkLink } from '../../session/branchWorkLinkOf';

type OpenParams = {
  readonly link: BranchWorkLink;
};

type Props = {
  readonly link: BranchWorkLink | null;
  readonly onOpen: (params: OpenParams) => void;
};

export const BranchWorkLinkButton = ({ link, onOpen }: Props) =>
  link === null ? null : (
    <Button variant="quiet" size="xs" onClick={() => onOpen({ link })}>
      {link.label}
    </Button>
  );
