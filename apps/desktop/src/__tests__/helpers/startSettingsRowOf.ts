import { fireEvent, within } from '@testing-library/react';

type Params = {
  readonly group: HTMLElement;
};

export const startSettingsRowOf = ({ group }: Params) => {
  const more = within(group).queryByRole('button', { name: /^More/ });
  if (more !== null) {
    fireEvent.click(more);
  }
  return within(group);
};
