import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Input, useEscapeLayer } from '@goodboy/ui';
import type { MonitorProcess, PortRow } from '@goodboy/core';
import { useAppStore } from '../../../../store';
import { PIN_DESCRIPTION_MAX } from '../../../../store/slices/monitoring/pinDescription';
import { PORT_EDIT_EVENT, type PortEditRequest } from '../../../actions/kinds/port';
import { portLabel } from '../../portLabel';
import { portRowName } from '../../portRowName';
import { PortRowItem } from './PortRowItem';
import { PortRowMenu } from '../../../actions/PortRowMenu';

type Props = {
  readonly row: PortRow;
  readonly process: MonitorProcess | null;
  readonly now: number;
};

type EventParams = {
  readonly event: Event;
};

type KeyDownParams = {
  readonly event: KeyboardEvent<HTMLInputElement>;
};

const editRequestOf = ({ event }: EventParams): PortEditRequest | null => {
  if (
    !(event instanceof CustomEvent) ||
    typeof event.detail !== 'object' ||
    event.detail === null
  ) {
    return null;
  }
  const port: unknown = event.detail.port;
  return typeof port === 'number' ? { port } : null;
};

export const PinnedRow = ({ row, process, now }: Props) => {
  const pinPort = useAppStore((state) => state.pinPort);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const isFinishedRef = useRef(true);
  const isSavingRef = useRef(false);
  const label = portLabel({ row });
  const labelRef = useRef(label);
  labelRef.current = label;

  useEffect(() => {
    const onRequest = ({ event }: EventParams) => {
      if (editRequestOf({ event })?.port !== row.port) {
        return;
      }
      isFinishedRef.current = false;
      setErrorText(null);
      setDraft(labelRef.current);
      setIsEditing(true);
    };
    const listener: EventListener = (event) => onRequest({ event });
    window.addEventListener(PORT_EDIT_EVENT, listener);
    return () => window.removeEventListener(PORT_EDIT_EVENT, listener);
  }, [row.port]);

  const save = async (): Promise<void> => {
    if (isFinishedRef.current || isSavingRef.current) {
      return;
    }
    isSavingRef.current = true;
    const isSaved = await pinPort({ port: row.port, description: draft });
    isSavingRef.current = false;
    if (isFinishedRef.current) {
      return;
    }
    if (!isSaved) {
      setErrorText("Couldn't save. Press Enter to retry.");
      return;
    }
    isFinishedRef.current = true;
    setErrorText(null);
    setIsEditing(false);
  };

  const cancel = () => {
    isFinishedRef.current = true;
    setErrorText(null);
    setIsEditing(false);
  };

  const onKeyDown = ({ event }: KeyDownParams) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void save();
    }
  };

  useEscapeLayer(cancel, isEditing);

  const nameSlot = isEditing ? (
    <div className="flex min-w-0 flex-col gap-1">
      <Input
        autoFocus
        aria-label={`Description for :${row.port}`}
        aria-invalid={errorText !== null}
        placeholder="Description"
        maxLength={PIN_DESCRIPTION_MAX}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => onKeyDown({ event })}
        onBlur={() => void save()}
      />
      {errorText !== null ? (
        <span role="alert" className="text-meta text-danger">
          {errorText}
        </span>
      ) : null}
    </div>
  ) : undefined;

  return (
    <PortRowItem
      row={row}
      process={process}
      now={now}
      name={portRowName({ row, isPinned: true })}
      nameSlot={nameSlot}
      actions={<PortRowMenu port={row.port} layer="pinned" description={portLabel({ row })} />}
    />
  );
};
