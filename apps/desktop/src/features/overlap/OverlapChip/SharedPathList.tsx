import { Tooltip } from '@goodboy/ui';
import { MiddleText } from '../../../shared/components/MiddleText';

type Props = {
  readonly paths: ReadonlyArray<string>;
};

const PATH_TAIL = /[^/]{1,24}$/;

export const SharedPathList = ({ paths }: Props) => (
  <ul className="flex min-w-0 flex-col">
    {paths.map((path) => (
      <Tooltip key={path} content={path}>
        <li data-shared-path={path} className="flex min-w-0 text-code text-muted-foreground">
          <MiddleText value={path} tail={PATH_TAIL} />
        </li>
      </Tooltip>
    ))}
  </ul>
);
