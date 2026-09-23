import { useState } from 'react';
import { ConfirmPopover, formatError, IconButton } from '@goodboy/ui';
import { Unplug } from 'lucide-react';
import { useToast } from '../../../../app/components/Toast';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

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
    <ConfirmPopover
      role="danger"
      icon={<Unplug size={ICON_SIZE.row} aria-hidden />}
      title={`Disconnect ${label}?`}
      description={description}
      confirmLabel="Disconnect"
      isOpen={isArmed}
      onConfirm={confirm}
      onCancel={() => setIsArmed(false)}
      trigger={() => (
        <IconButton
          icon={Unplug}
          label={`Disconnect ${label}`}
          aria-expanded={isArmed}
          onClick={() => setIsArmed(true)}
        />
      )}
    />
  );
};
