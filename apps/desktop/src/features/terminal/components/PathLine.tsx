import { Tooltip } from '@goodboy/ui';
import { MiddleText } from '../../../shared/components/MiddleText';
import { pathTail } from '../pathTail';

type Props = {
  readonly path: string;
};

export const PathLine = ({ path }: Props) => (
  <Tooltip content={path} anchorClassName="flex min-w-0">
    <span className="flex min-w-0 font-mono text-meta text-muted-foreground">
      <MiddleText value={path} tail={pathTail({ path })} />
    </span>
  </Tooltip>
);
