import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { selectPortRows } from '../../store/slices/monitoring/selectPortRows';
import type { OutputHandoff } from '../../shared/utils/outputHandoff';
import { browserHost } from './browserHost';
import { elementAttachmentOf } from './elementAttachmentOf';
import { elementFileOf } from './elementFileOf';
import { originOf } from './originOf';
import type { BrowserPickedElement } from './types';

type QueueParams = {
  readonly agentId: AgentId;
  readonly handoff: OutputHandoff;
};

type Params = {
  readonly sessionId: SessionId;
  readonly tabId: string;
  readonly doc: string;
  readonly agentId: AgentId;
  readonly elements: ReadonlyArray<BrowserPickedElement>;
  readonly note: string;
  readonly pageTitle: string;
  readonly queue: (params: QueueParams) => boolean;
  readonly isTabStill: () => boolean;
};

type CropParams = Pick<Params, 'sessionId' | 'tabId' | 'doc' | 'isTabStill'> & {
  readonly element: BrowserPickedElement;
};

export type PickAddResult = 'added' | 'agent-gone';

const cropOf = async ({
  sessionId,
  tabId,
  doc,
  element,
  isTabStill,
}: CropParams): Promise<string | null> => {
  if (element.rect === null) {
    return null;
  }
  const crop = await browserHost
    .elementSnapshot({ tabId, sessionId, doc, rect: element.rect })
    .catch(() => null);
  return isTabStill() ? crop : null;
};

export const addPickedElements = async ({
  sessionId,
  tabId,
  doc,
  agentId,
  elements,
  note,
  pageTitle,
  queue,
  isTabStill,
}: Params): Promise<PickAddResult> => {
  const final = await browserHost
    .pick({ tabId, sessionId, op: 'stop', round: 0 })
    .catch(() => null);
  const fresh =
    final !== null && final.doc === doc && final.picks.length === elements.length
      ? final.picks
      : elements;
  const crops = await Promise.all(
    fresh.map((element) => cropOf({ sessionId, tabId, doc, element, isTabStill })),
  );
  const state = useAppStore.getState();
  const rows = selectPortRows(state);
  const processes = state.monitorSnapshot?.processes ?? [];
  const handoffs = fresh.flatMap((element, index) => {
    const origin = originOf({ url: element.url });
    return elementAttachmentOf({
      element,
      pageTitle,
      fileLine: elementFileOf({ element, sessionId, rows, processes }),
      crop: crops[index] ?? null,
      now: Date.now(),
      iconSrc: origin === null ? null : (state.browserFavicons[origin] ?? null),
    });
  });
  for (const handoff of handoffs) {
    if (!queue({ agentId, handoff })) {
      return 'agent-gone';
    }
  }
  const text = note.trim();
  if (text !== '') {
    const draft = useAppStore.getState().agentDraft[agentId] ?? '';
    useAppStore
      .getState()
      .setAgentDraft(agentId, draft.trim() === '' ? text : `${draft.trimEnd()}\n\n${text}`);
  }
  return 'added';
};
