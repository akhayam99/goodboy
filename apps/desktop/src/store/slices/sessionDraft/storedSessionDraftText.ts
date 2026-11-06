import type { WorkspaceId } from '@goodboy/types';
import { STORAGE_PREFIXES } from '../../../shared/lib/storage-keys';
import { storageKeyOf } from '../../../shared/lib/storageKeyOf';
import { storedText } from '../../../shared/lib/storedText';
import type { SessionDraft } from './state';

type TextField = 'workflowGoal' | 'agentPrompt' | 'autoGoal';

type SessionDraftText = Pick<SessionDraft, TextField>;

type WorkspaceParams = Readonly<{
  workspaceId: WorkspaceId;
}>;

type FieldKeyParams = WorkspaceParams &
  Readonly<{
    field: TextField;
  }>;

type WriteParams = WorkspaceParams &
  Readonly<{
    text: SessionDraftText;
  }>;

const FIELDS: ReadonlyArray<TextField> = ['workflowGoal', 'agentPrompt', 'autoGoal'];

const fieldKeyOf = ({ workspaceId, field }: FieldKeyParams): string =>
  storageKeyOf({ prefix: STORAGE_PREFIXES.sessionDraft, id: `${workspaceId}:${field}` });

export const storedSessionDraftText = {
  read: ({ workspaceId }: WorkspaceParams): SessionDraftText | null => {
    const text: SessionDraftText = {
      workflowGoal: storedText.read({ key: fieldKeyOf({ workspaceId, field: 'workflowGoal' }) }),
      agentPrompt: storedText.read({ key: fieldKeyOf({ workspaceId, field: 'agentPrompt' }) }),
      autoGoal: storedText.read({ key: fieldKeyOf({ workspaceId, field: 'autoGoal' }) }),
    };
    return FIELDS.every((field) => text[field].trim() === '') ? null : text;
  },
  write: ({ workspaceId, text }: WriteParams): void => {
    for (const field of FIELDS) {
      storedText.write({ key: fieldKeyOf({ workspaceId, field }), text: text[field] });
    }
  },
  forget: ({ workspaceId }: WorkspaceParams): void => {
    for (const field of FIELDS) {
      storedText.write({ key: fieldKeyOf({ workspaceId, field }), text: '' });
    }
  },
};
