import { AlertCircle, RefreshCw } from 'lucide-react';
import { TAB_ICON_BTN } from '../lib';

type Props = {
  readonly message: string;
  readonly onRetry: () => void;
};

export const ErrorRow = ({ message, onRetry }: Props) => {
  return (
    <div className="flex items-center gap-1.5 text-2xs text-danger">
      <AlertCircle size={11} aria-hidden />
      <span className="min-w-0 flex-1 truncate" title={message}>
        {message}
      </span>
      <button
        type="button"
        onClick={onRetry}
        title="Retry"
        aria-label="Retry"
        className={TAB_ICON_BTN}
      >
        <RefreshCw size={10} aria-hidden />
      </button>
    </div>
  );
};
