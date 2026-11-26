import { isPortColumnShown } from './isPortColumnShown';
import { usePortColumns } from './usePortColumns';

type Props = Record<never, never>;

export const MetricBlanks = ({}: Props) => {
  const columns = usePortColumns({});
  return (
    <>
      {isPortColumnShown({ columns, column: 'up' }) ? <span /> : null}
      {isPortColumnShown({ columns, column: 'cpu' }) ? <span /> : null}
      {isPortColumnShown({ columns, column: 'memory' }) ? <span /> : null}
    </>
  );
};
