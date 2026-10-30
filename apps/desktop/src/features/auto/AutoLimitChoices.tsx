import { Chip, TEXT_ROLE, formatUsd } from '@goodboy/ui';
import { AUTO_LIMIT_COPY } from './autoLimitCopy';
import { autoLimitChoicesOf } from './autoLimitChoicesOf';

type Props = {
  readonly usd: number | null;
  readonly defaultUsd: number | null;
  readonly onPick: (usd: number) => void;
};

export const AutoLimitChoices = ({ usd, defaultUsd, onPick }: Props) => (
  <div role="group" aria-label="Amounts" className="flex flex-wrap items-center gap-1">
    {autoLimitChoicesOf({ usd, defaultUsd }).map((amount) => (
      <Chip
        key={amount}
        tone={amount === usd ? 'primary' : 'neutral'}
        kind="reference"
        as="button"
        ariaPressed={amount === usd}
        label={
          <>
            {formatUsd(amount)}
            {amount === defaultUsd ? (
              <span className={TEXT_ROLE.hint}>{AUTO_LIMIT_COPY.defaultTag}</span>
            ) : null}
          </>
        }
        onClick={() => onPick(amount)}
      />
    ))}
  </div>
);
