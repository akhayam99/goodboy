import { useLayoutEffect } from 'react';
import { StudioCloseButton } from './StudioCloseButton';

type Props = {
  readonly label: string;
  readonly onClose: () => void;
  readonly onClaim: () => () => void;
};

export const HeaderCloseButton = ({ label, onClose, onClaim }: Props) => {
  useLayoutEffect(() => onClaim(), [onClaim]);
  return <StudioCloseButton label={label} onClose={onClose} />;
};
