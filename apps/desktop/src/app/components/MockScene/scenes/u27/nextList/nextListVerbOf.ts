import type { CardVerb } from '../../../../../../features/session/central/next/useActionCardActions';

type Params = {
  readonly label: string;
  readonly ariaLabel?: string;
};

export const nextListVerbOf = ({ label, ariaLabel }: Params): CardVerb => ({
  label,
  ariaLabel,
  isDisabled: false,
  isBusy: false,
  confirmRole: null,
  confirm: null,
  hasPicker: false,
  run: () => undefined,
});
