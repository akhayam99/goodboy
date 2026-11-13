import { useEffect } from 'react';
import { markBoot } from '../../../../../shared/lib/bootMarks';

type Params = {
  readonly isShown: boolean;
};

export const useMarkBoardShown = ({ isShown }: Params): void => {
  useEffect(() => {
    if (isShown) {
      markBoot({ name: 'board' });
    }
  }, [isShown]);
};
