import type { Session } from '@goodboy/types';
import { DoneSection } from '../../../../../features/session/central/done/DoneSection';
import { useDoneRows } from '../../../../../features/session/central/done/useDoneRows';
import { useSessionWorkModel } from '../../../../../features/session/central/useSessionWorkModel';
import { DONE_NOW } from './centralDoneSeed';

type Props = {
  readonly session: Session;
  readonly initialOpenId: string | null;
};

export const CentralDoneBody = ({ session, initialOpenId }: Props) => {
  const model = useSessionWorkModel({ session });
  const days = useDoneRows({ session, model, now: DONE_NOW });
  return <DoneSection session={session} model={model} days={days} initialOpenId={initialOpenId} />;
};
