import { Tooltip } from '@goodboy/ui';
import { NAMES } from '../../../../../shared/names';

type Props = {
  readonly ruleValue: string;
};

export const RuleDot = ({ ruleValue }: Props) => {
  const text = `${NAMES.runDefaults}: ${ruleValue}`;
  return (
    <Tooltip content={text}>
      <span
        role="img"
        aria-label={text}
        data-rule-dot=""
        className="block size-1.5 shrink-0 rounded-full bg-info"
      />
    </Tooltip>
  );
};
