// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { brandId, type ChatId, type IsoDateTime, type ModelKey } from '@goodboy/types';
import { draftChatMessage } from '../conversation/draftChatMessage';
import { summarizeChatForWork } from './summarizeChatForWork';

const CHAT = brandId<ChatId>({ value: 'chat-ledger' });
const AT = brandId<IsoDateTime>({ value: '2026-01-01T00:00:00.000Z' });

type MessageParams = {
  readonly role: 'user' | 'assistant';
  readonly content: string;
};

const message = ({ role, content }: MessageParams) =>
  draftChatMessage({ chatId: CHAT, role, content, status: 'done', at: AT });

const run = async ({ preferred }: { readonly preferred: 'it' | null }): Promise<string> => {
  const summarizeForWork = vi.fn(async () => '{"title":"Fix export"}');
  await summarizeChatForWork({
    backend: { summarizeForWork },
    chat: {
      title: 'Ledger export',
      provider: 'anthropic',
      model: brandId<ModelKey>({ value: 'sonnet' }),
    },
    messages: [
      message({ role: 'user', content: 'Why is the ledger export slow?' }),
      message({ role: 'assistant', content: 'Cache.' }),
    ],
    projectNames: ['ledger-core'],
    preferred,
  });
  return JSON.stringify(summarizeForWork.mock.calls);
};

describe('summarizeChatForWork', () => {
  it('asks for no language on Auto', async () => {
    expect(await run({ preferred: null })).not.toContain('in Italian');
  });

  it('asks for the brief in Italian when Italian is set', async () => {
    const prompt = await run({ preferred: 'it' });

    expect(prompt).toContain('Write \\"title\\", \\"goal\\" and \\"know\\" in Italian');
    expect(prompt).toContain(
      'Keep file paths, project names, identifiers and quoted text verbatim',
    );
  });
});
