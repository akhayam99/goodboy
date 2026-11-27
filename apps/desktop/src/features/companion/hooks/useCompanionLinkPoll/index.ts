import { useEffect } from 'react';
import { retainCompanionLinkPoll } from '../../retainCompanionLinkPoll';

type Params = {
  readonly isOn: boolean;
};

export const useCompanionLinkPoll = ({ isOn }: Params): void => {
  useEffect(() => {
    if (!isOn) {
      return;
    }
    return retainCompanionLinkPoll();
  }, [isOn]);
};
