import { fireEvent, within } from '@testing-library/react';

type Params = {
  readonly group: HTMLElement;
};

export const startSettingsRowOf = ({ group }: Params) => {
  const change = within(group).queryByRole('button', { name: 'Change' });
  if (change !== null) {
    fireEvent.click(change);
  }
  return within(group);
};
