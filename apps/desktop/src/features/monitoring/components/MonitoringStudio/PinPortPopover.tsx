import { useState, type FormEvent } from 'react';
import { Pin } from 'lucide-react';
import {
  AnchoredPopover,
  Button,
  ICON_SIZE,
  Input,
  useDropdown,
  type ButtonVariant,
} from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { isValidPort } from '../../../../store/slices/monitoring/isValidPort';
import { PIN_DESCRIPTION_MAX } from '../../../../store/slices/monitoring/pinDescription';

type Props = {
  readonly variant: ButtonVariant;
};

export const PinPortPopover = ({ variant }: Props) => {
  const dropdown = useDropdown({ align: 'end', width: 'w-80', expectedWidth: 320 });
  const pinPort = useAppStore((state) => state.pinPort);
  const [portText, setPortText] = useState('');
  const [description, setDescription] = useState('');
  const [hasFailed, setHasFailed] = useState(false);
  const port = Number(portText);
  const isPortValid = portText.trim() !== '' && isValidPort({ port });
  const hasError = portText.trim() !== '' && !isPortValid;

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!isPortValid) {
      return;
    }
    const isPinned = await pinPort({ port, description });
    setHasFailed(!isPinned);
    if (!isPinned) {
      return;
    }
    setPortText('');
    setDescription('');
    dropdown.close();
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Pin a port"
      hasBackdrop
      className="p-3"
      trigger={
        <Button size="sm" variant={variant} onClick={dropdown.toggle} aria-expanded={dropdown.open}>
          <Pin size={ICON_SIZE.row} aria-hidden />
          Pin a port
        </Button>
      }
    >
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="pin-port-number" className="text-label text-foreground">
            Port
          </label>
          <Input
            id="pin-port-number"
            inputMode="numeric"
            placeholder="5005"
            value={portText}
            aria-invalid={hasError}
            onChange={(event) => {
              setPortText(event.target.value);
              setHasFailed(false);
            }}
            autoFocus
          />
          {hasError ? (
            <span role="alert" className="text-meta text-danger">
              Use a number from 1 to 65535
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="pin-port-description" className="text-label text-foreground">
            Description
          </label>
          <Input
            id="pin-port-description"
            placeholder="Optional"
            maxLength={PIN_DESCRIPTION_MAX}
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              setHasFailed(false);
            }}
          />
        </div>
        {hasFailed ? (
          <span role="alert" className="text-meta text-danger">
            Couldn't pin the port. Try again.
          </span>
        ) : null}
        <Button type="submit" size="sm" disabled={!isPortValid}>
          Pin
        </Button>
      </form>
    </AnchoredPopover>
  );
};
