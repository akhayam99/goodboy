import type { PortRow } from '@goodboy/core';
import type { PortLayer } from '../../../actions/kinds/port';
import { usePortTarget } from '../../hooks/usePortTarget';
import { PortRowActions } from './PortRowActions';

type Props = {
  readonly row: PortRow;
  readonly layer: PortLayer;
};

export const SharedProcessActions = ({ row, layer }: Props) => {
  const target = usePortTarget({ row, layer, isProcess: true });
  return <PortRowActions target={target} hasStop hasMenu={false} />;
};
