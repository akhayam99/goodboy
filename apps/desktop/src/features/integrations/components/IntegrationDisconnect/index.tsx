import { useState } from 'react';
import { IconButton, InlineConfirm } from '@goodboy/ui';
import { Unplug } from 'lucide-react';
import { useToast } from '../../../../app/components/Toast';
import { formatError } from '../../../../shared/lib/errors';

type Props = {
  readonly label: string;
  readonly description: string;
  readonly onDisconnect: () => Promise<void>;
};

export const IntegrationDisconnect = ({ label, description, onDisconnect }: Props) => {
  const [isArmed, setIsArmed] = useState(false);
  const { showToast } = useToast();

  const confirm = async () => {
    try {
      await onDisconnect();
      setIsArmed(false);
    } catch (err) {
      showToast('error', formatError(err));
    }
  };

  return (
    <div className="relative flex shrink-0 items-center">
      {isArmed ? null : (
        <IconButton icon={Unplug} label={`Disconnect ${label}`} onClick={() => setIsArmed(true)} />
      )}
      {isArmed ? (
        <InlineConfirm
          role="danger"
          icon={<Unplug size={12} aria-hidden />}
          title={`Disconnect ${label}?`}
          description={description}
          confirmLabel={`Disconnect ${label}`}
          autoDisarmMs={4000}
          onConfirm={confirm}
          onCancel={() => setIsArmed(false)}
          className="absolute right-0 top-full z-40 mt-1 w-72 bg-background shadow-lg"
        />
      ) : null}
    </div>
  );
};
