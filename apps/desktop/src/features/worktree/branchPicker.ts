import type { ListboxOption } from '@goodboy/ui';

export const BRANCH_PICKER_MAX_WIDTH = 480;

type Params = {
  readonly name: string;
};

export const branchPickerOption = ({ name }: Params): ListboxOption<string> => ({
  value: name,
  label: name,
  isCode: true,
});
