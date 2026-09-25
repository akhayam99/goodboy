import { Link, RefreshCw } from 'lucide-react';
import type { OverflowMenuItem } from '@goodboy/ui';
import type { RecordVerb } from '../RecordActions/types';

const SEPARATOR: OverflowMenuItem = { kind: 'separator', key: 'destructive-separator' };

type Params = {
  readonly overflow: ReadonlyArray<RecordVerb>;
  readonly sessionVerbs: ReadonlyArray<RecordVerb>;
  readonly destructive: ReadonlyArray<RecordVerb>;
  readonly onRefresh: (() => void) | null;
  readonly onCopyLink: (() => void) | null;
  readonly onConfirm: (key: string) => void;
  readonly onDone: () => void;
};

type VerbItemParams = {
  readonly verb: RecordVerb;
  readonly isDestructive: boolean;
  readonly onConfirm: (key: string) => void;
  readonly onDone: () => void;
};

const verbItem = ({
  verb,
  isDestructive,
  onConfirm,
  onDone,
}: VerbItemParams): OverflowMenuItem => ({
  kind: 'item',
  key: verb.key,
  label: verb.confirm == null ? verb.label : `${verb.label}…`,
  icon: verb.icon,
  onClick: () => {
    if (verb.confirm != null) {
      onConfirm(verb.key);
      return;
    }
    onDone();
    void verb.onRun();
  },
  disabled: verb.blockedReason != null || verb.isBusy,
  ...(verb.blockedReason != null && { description: verb.blockedReason }),
  ...(isDestructive && { destructive: true }),
});

export const recordMenuItems = ({
  overflow,
  sessionVerbs,
  destructive,
  onRefresh,
  onCopyLink,
  onConfirm,
  onDone,
}: Params): ReadonlyArray<OverflowMenuItem> => {
  const utilities: Array<OverflowMenuItem> = [];
  if (onRefresh != null) {
    utilities.push({
      kind: 'item',
      key: 'refresh',
      label: 'Refresh',
      icon: RefreshCw,
      onClick: () => {
        onDone();
        onRefresh();
      },
    });
  }
  if (onCopyLink != null) {
    utilities.push({
      kind: 'item',
      key: 'copy-link',
      label: 'Copy link',
      icon: Link,
      onClick: () => {
        onDone();
        onCopyLink();
      },
    });
  }
  const common: ReadonlyArray<OverflowMenuItem> = [
    ...overflow.map((verb) => verbItem({ verb, isDestructive: false, onConfirm, onDone })),
    ...utilities,
    ...sessionVerbs.map((verb) => verbItem({ verb, isDestructive: false, onConfirm, onDone })),
  ];
  if (destructive.length === 0) {
    return common;
  }
  return [
    ...common,
    ...(common.length > 0 ? [SEPARATOR] : []),
    ...destructive.map((verb) => verbItem({ verb, isDestructive: true, onConfirm, onDone })),
  ];
};
