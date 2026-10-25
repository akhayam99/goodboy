import { createMemoryAskBackend } from '../../../test/createMemoryAskBackend';
import { mockAskResponder } from './backends/ask/mockAskResponder';
import { createMemoryChatBackend } from '../../../test/createMemoryChatBackend';
import { mockChatResponder } from './backends/chat/mockChatResponder';
import { mockChatSeed } from './backends/chat/mockChatSeed';
import { mockWorkSummarizer } from './backends/chat/mockWorkSummarizer';
import { mockArtifactProvenance, mockMountDiffStat } from './mockFixtureData';

export const mockRuntime = () => ({
  chat: createMemoryChatBackend({
    respond: mockChatResponder,
    seed: mockChatSeed,
    summarize: mockWorkSummarizer,
  }),
  ask: createMemoryAskBackend({ respond: mockAskResponder }),
  fixtures: { mountDiffStat: mockMountDiffStat, artifactProvenance: mockArtifactProvenance },
});
