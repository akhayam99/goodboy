import type { SliceDeps } from '../../slice-types';
import { clearAskDraft } from './clearAskDraft';
import { loadAskThreads } from './loadAskThreads';
import { newAskThread } from './newAskThread';
import { openAsk } from './openAsk';
import { sendAskQuestion } from './sendAskQuestion';
import { setAskDraft } from './setAskDraft';
import { setAskRouting } from './setAskRouting';
import { showAskThread } from './showAskThread';
import { askInitialState } from './state';
import { stopAskReply } from './stopAskReply';
import type { AskSlice } from './types';

export const createAskSlice = ({ set, get }: SliceDeps): AskSlice => ({
  ...askInitialState,
  loadAskThreads: loadAskThreads(set, get),
  showAskThread: showAskThread(set, get),
  newAskThread: newAskThread(set, get),
  sendAskQuestion: sendAskQuestion(set, get),
  stopAskReply: stopAskReply(set, get),
  setAskRouting: setAskRouting(set, get),
  setAskDraft: setAskDraft(set),
  clearAskDraft: clearAskDraft(set),
  openAsk: openAsk(get),
});
