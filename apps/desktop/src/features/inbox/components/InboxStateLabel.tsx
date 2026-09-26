import { RecordState } from '../../../shared/components/StudioDetail/RecordState';
import type { InboxState } from '../types';

type Props = {
  readonly state: InboxState;
  readonly label: string;
  readonly className?: string;
};

export const InboxStateLabel = ({ state, label, className }: Props) => (
  <RecordState category={state} label={label} className={className} />
);
