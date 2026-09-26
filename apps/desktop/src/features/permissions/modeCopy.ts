import { Eye, Hand, PencilLine, Zap, type LucideIcon } from 'lucide-react';
import type { ClaudePermissionMode } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';

export type PickerMode = Exclude<ClaudePermissionMode, 'dontAsk'>;

export type ModeCopy = {
  readonly mode: PickerMode;
  readonly label: string;
  readonly promise: string;
  readonly short: string;
  readonly tone: Tone;
  readonly icon: LucideIcon;
};

export const PICKER_MODES = [
  'plan',
  'default',
  'acceptEdits',
  'bypassPermissions',
] as const satisfies ReadonlyArray<PickerMode>;

export const DEFAULT_PERMISSION_MODE = 'bypassPermissions' satisfies PickerMode;

export const MODE_COPY: Record<PickerMode, ModeCopy> = {
  plan: {
    mode: 'plan',
    label: 'Read only',
    promise: 'Reads and answers. Changes nothing.',
    short: 'Changes nothing.',
    tone: 'neutral',
    icon: Eye,
  },
  default: {
    mode: 'default',
    label: 'Ask first',
    promise: "Stops before anything it hasn't been allowed, and asks you.",
    short: 'Asks before anything not allowed.',
    tone: 'info',
    icon: Hand,
  },
  acceptEdits: {
    mode: 'acceptEdits',
    label: 'Edits allowed',
    promise: 'Changes files in your projects. Asks before anything else.',
    short: 'Edits files, asks for the rest.',
    tone: 'warning',
    icon: PencilLine,
  },
  bypassPermissions: {
    mode: 'bypassPermissions',
    label: 'Full access',
    promise: 'Does anything without asking.',
    short: 'Never asks.',
    tone: 'danger',
    icon: Zap,
  },
};

type PickerModeParams = {
  readonly mode: ClaudePermissionMode;
};

export const pickerModeOf = ({ mode }: PickerModeParams): PickerMode =>
  mode === 'dontAsk' ? 'default' : mode;

export const modeCopyOf = ({ mode }: PickerModeParams): ModeCopy =>
  MODE_COPY[pickerModeOf({ mode })];
