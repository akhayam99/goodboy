import { IconButton } from './IconButton';
import { RefreshCw } from 'lucide-react';

type Props = {
  readonly label: string;
  readonly onClick: () => void;
  readonly isLoading?: boolean;
  readonly error?: string | null;
  readonly iconSize?: number;
  readonly className?: string;
};

export const RefreshIconButton = ({
  label,
  onClick,
  isLoading = false,
  error = null,
  iconSize = 13,
  className,
}: Props) => {
  return (
    <IconButton
      icon={RefreshCw}
      label={label}
      iconSize={iconSize}
      onClick={onClick}
      disabled={isLoading}
      busy={isLoading}
      tooltip={error != null && error !== '' ? `refresh failed: ${error}` : label}
      className={className}
    />
  );
};
