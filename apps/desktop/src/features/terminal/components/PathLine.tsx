import { Tooltip } from '@goodboy/ui';
import { MiddleText } from '../../../shared/components/MiddleText';

type Props = {
  readonly path: string;
};

const TAIL = /\/[^/]+\/[^/]+$/;

export const PathLine = ({ path }: Props) => (
  <Tooltip content={path} anchorClassName="flex min-w-0">
    <span className="flex min-w-0 font-mono text-meta text-muted-foreground">
      <MiddleText value={path} tail={TAIL} />
    </span>
  </Tooltip>
);
