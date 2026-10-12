import { ObjectOverflowMenu } from './components/ObjectOverflowMenu';
import type { PortLayer } from './kinds/port';

type Props = {
  readonly port: number;
  readonly layer: PortLayer;
  readonly description: string;
};

export const PortRowMenu = ({ port, layer, description }: Props) => (
  <ObjectOverflowMenu
    label={`Actions for :${port}`}
    target={{ kind: 'port', facts: { port, layer, description } }}
  />
);
