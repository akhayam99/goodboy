import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { selectActionRun } from '../../store/slices/action-runs/selectActionRun';
import type { OutputHandoff } from '../../shared/utils/outputHandoff';
import { browserFailureText } from './browserFailureText';
import { browserHost } from './browserHost';
import { originOf } from './originOf';
import { pageAttachmentOf } from './pageAttachmentOf';

export const PAGE_SEND_ACTION = 'browser.sendPage';

export type PageSendStatus = 'sent' | 'failed' | 'busy' | 'stale';

type KeyParams = {
  readonly sessionId: SessionId;
};

type Params = KeyParams & {
  readonly tabId: string;
  readonly rowId: string;
  readonly url: string;
  readonly agentId: AgentId;
  readonly queue: (params: QueueParams) => boolean;
};

type QueueParams = {
  readonly agentId: AgentId;
  readonly handoff: OutputHandoff;
};

type HostnameParams = {
  readonly url: string;
};

const AGENT_GONE_TEXT = "The agent isn't in this session anymore. Pick one and try again.";

export const pageSendKeyOf = ({ sessionId }: KeyParams): string =>
  `${PAGE_SEND_ACTION}:${sessionId}`;

const hostnameOf = ({ url }: HostnameParams): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
};

export const sendPageToAgent = async ({
  sessionId,
  tabId,
  rowId,
  url,
  agentId,
  queue,
}: Params): Promise<PageSendStatus> => {
  const key = pageSendKeyOf({ sessionId });
  const token = useAppStore
    .getState()
    .claimActionRun({ key, sessionId, actionId: PAGE_SEND_ACTION, choice: rowId });
  if (token === null) {
    return 'busy';
  }
  let handoff: OutputHandoff;
  try {
    const page = await browserHost.pageText({ tabId, sessionId, host: hostnameOf({ url }) });
    const origin = originOf({ url: page.url });
    const iconSrc =
      origin === null ? null : (useAppStore.getState().browserFavicons[origin] ?? null);
    handoff = pageAttachmentOf({ page, now: Date.now(), iconSrc });
  } catch (error) {
    const isApplied = useAppStore.getState().finishActionRun({
      key,
      token,
      result: { kind: 'failed', message: browserFailureText({ error }), error },
    });
    return isApplied ? 'failed' : 'stale';
  }
  if (selectActionRun({ state: useAppStore.getState(), key })?.token !== token) {
    return 'stale';
  }
  if (!queue({ agentId, handoff })) {
    useAppStore.getState().finishActionRun({
      key,
      token,
      result: { kind: 'failed', message: AGENT_GONE_TEXT, error: new Error('agent-gone') },
    });
    return 'failed';
  }
  useAppStore.getState().finishActionRun({ key, token, result: { kind: 'silent' } });
  return 'sent';
};
