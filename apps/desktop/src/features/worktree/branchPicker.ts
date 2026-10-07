import type { ListboxOption } from '@goodboy/ui';
import { splitBranchLabel } from '../../shared/utils/branchLabel';

export const BRANCH_PICKER_MAX_WIDTH = 480;

type Params = {
  readonly name: string;
};

export const branchPickerOption = ({ name }: Params): ListboxOption<string> => {
  const { tail } = splitBranchLabel({ branch: name });
  return {
    value: name,
    label: name,
    isCode: true,
    ...(tail === '' ? {} : { tail }),
  };
};
