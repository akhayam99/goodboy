import type { ShortcutId } from '../keyboard/registry';

export const ACTION_RING_LIMIT = 10;

const ACTION_NAME = /^[a-z][a-z0-9_-]*(?:\.[a-z0-9_-]+){0,3}$/;

const MAX_NAME_LENGTH = 48;

let ring: ReadonlyArray<string> = [];

type NameParams = {
  readonly name: string;
};

export const isActionName = ({ name }: NameParams): boolean =>
  name.length <= MAX_NAME_LENGTH && ACTION_NAME.test(name);

const push = ({ name }: NameParams): void => {
  if (!isActionName({ name }) || ring.at(-1) === name) {
    return;
  }
  ring = [...ring, name].slice(-ACTION_RING_LIMIT);
};

type ShortcutParams = {
  readonly id: ShortcutId;
};

export const recordShortcut = ({ id }: ShortcutParams): void => push({ name: id });

type ScreenParams = {
  readonly label: string;
};

export const screenActionName = ({ label }: ScreenParams): string =>
  `screen.${label
    .toLowerCase()
    .split(/\s[›·]\s/)
    .map((part) => part.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    .filter((part) => part !== '')
    .slice(0, 3)
    .join('.')}`;

export const recordScreen = ({ label }: ScreenParams): void =>
  push({ name: screenActionName({ label }) });

export const recentActions = (): ReadonlyArray<string> => ring;
