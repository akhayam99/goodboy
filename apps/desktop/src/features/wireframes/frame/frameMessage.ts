export type FrameMessage =
  | Readonly<{ type: 'navigated'; path: string; height: number }>
  | Readonly<{ type: 'picked'; nodeId: string; label: string }>
  | Readonly<{ type: 'pickEnded' }>;

export type FrameCommand =
  Readonly<{ type: 'reveal'; nodeId: string }> | Readonly<{ type: 'pick'; isOn: boolean }>;

const MAX_FIELD = 512;

const PAGE_PATH = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*(\/[A-Za-z0-9_-][A-Za-z0-9_.-]*){0,2}$/;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = ({ value }: { readonly value: unknown }): string | null =>
  typeof value === 'string' && value.length <= MAX_FIELD ? value : null;

const isPagePath = ({ path }: { readonly path: string }): boolean =>
  PAGE_PATH.test(path) && !path.includes('..');

export const parseFrameMessage = ({ data }: { readonly data: unknown }): FrameMessage | null => {
  if (!isRecord(data) || data.channel !== 'gbframe') {
    return null;
  }
  if (data.type === 'navigated') {
    const path = text({ value: data.path });
    if (path === null || !isPagePath({ path })) {
      return null;
    }
    const height =
      typeof data.height === 'number' && Number.isFinite(data.height) ? data.height : 0;
    return { type: 'navigated', path, height: Math.max(0, Math.round(height)) };
  }
  if (data.type === 'picked') {
    const nodeId = text({ value: data.nodeId });
    const label = text({ value: data.label });
    if (nodeId === null || nodeId.length === 0 || label === null) {
      return null;
    }
    return { type: 'picked', nodeId, label };
  }
  if (data.type === 'pickEnded') {
    return { type: 'pickEnded' };
  }
  return null;
};

export const postToFrame = ({
  frame,
  command,
}: {
  readonly frame: HTMLIFrameElement | null;
  readonly command: FrameCommand;
}): void => {
  frame?.contentWindow?.postMessage({ channel: 'goodboy', ...command }, '*');
};
