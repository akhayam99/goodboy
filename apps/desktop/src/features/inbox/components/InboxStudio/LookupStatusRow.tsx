import { ListGridLine } from '@goodboy/ui';
import { useNow } from '../../../../shared/hooks/useNow';
import type { LookupStatus } from '../../../integrations/issueCode/lookupCopy';

type Props = {
  readonly status: LookupStatus;
  readonly retryAt?: number | null;
  readonly onAction: (status: LookupStatus) => void;
};

const useCountdownSeconds = (target: number | null | undefined): number | null => {
  const now = useNow(1_000, target != null);
  return target == null ? null : Math.max(0, Math.ceil((target - now) / 1000));
};

export const LookupStatusRow = ({ status, retryAt, onAction }: Props) => {
  const secondsLeft = useCountdownSeconds(retryAt);
  const text =
    secondsLeft === null ? status.text : `${status.text} Trying again in ${secondsLeft}s.`;
  if (status.action === null) {
    return <ListGridLine>{text}</ListGridLine>;
  }
  return (
    <ListGridLine onClick={() => onAction(status)}>{`${text} ${status.action.label}`}</ListGridLine>
  );
};
