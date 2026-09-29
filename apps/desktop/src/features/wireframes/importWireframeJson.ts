import {
  GENERIC_THEME_NAME,
  validateWireframeDocument,
  type WireframeAdjustment,
  type WireframeDevice,
  type WireframeIssue,
} from '@goodboy/core';
import type { WireframeFidelity } from './wireframeFidelity';

export type WireframeImport =
  | Readonly<{ status: 'invalid'; fileName: string; issues: ReadonlyArray<WireframeIssue> }>
  | Readonly<{
      status: 'ready';
      fileName: string;
      title: string;
      sourceText: string;
      fidelity: WireframeFidelity;
      screenCount: number;
      device: WireframeDevice | null;
      version: number;
      adjustments: ReadonlyArray<string>;
    }>;

const titleOf = ({ fileName }: { readonly fileName: string }): string => {
  const base = fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  if (base.length === 0) {
    return 'Imported wireframe';
  }
  return `${base.charAt(0).toUpperCase()}${base.slice(1)}`;
};

const describeAdjustment = ({
  adjustment,
}: {
  readonly adjustment: WireframeAdjustment;
}): string => {
  if (adjustment.change === 'hidden') {
    const total = adjustment.moved + adjustment.clipped + adjustment.dropped;
    return `${total} more ${total === 1 ? 'adjustment' : 'adjustments'} of the same kind`;
  }
  const times = adjustment.count > 1 ? ` (${adjustment.count} times)` : '';
  return `${adjustment.path} ${adjustment.message}${times}`;
};

const rawVersion = ({ value }: { readonly value: unknown }): number => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return 0;
  }
  const version = (value as Readonly<Record<string, unknown>>)['version'];
  return typeof version === 'number' ? version : 0;
};

export const readWireframeImport = ({
  fileName,
  text,
}: {
  readonly fileName: string;
  readonly text: string;
}): WireframeImport => {
  const parsed = ((): unknown => {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return undefined;
    }
  })();
  if (parsed === undefined) {
    return {
      status: 'invalid',
      fileName,
      issues: [{ path: '', message: 'the file is not valid JSON' }],
    };
  }
  const result = validateWireframeDocument({ value: parsed });
  if (result.status === 'invalid') {
    return { status: 'invalid', fileName, issues: result.issues };
  }
  const rest =
    typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? Object.fromEntries(Object.entries(parsed).filter(([key]) => key !== '$schema'))
      : parsed;
  return {
    status: 'ready',
    fileName,
    title: titleOf({ fileName }),
    sourceText: JSON.stringify(rest, null, 2),
    fidelity: result.document.theme.name === GENERIC_THEME_NAME ? 'low' : 'high',
    screenCount: result.document.screens.length,
    device: result.document.device ?? null,
    version: rawVersion({ value: parsed }),
    adjustments: result.adjustments.map((adjustment) => describeAdjustment({ adjustment })),
  };
};
