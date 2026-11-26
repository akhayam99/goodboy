const posted = new Map<string, string>();

type KeyParams = {
  readonly draftId: string;
};

type MarkParams = {
  readonly draftId: string;
  readonly body: string;
};

export const markPosted = ({ draftId, body }: MarkParams): void => {
  posted.set(draftId, body);
};

export const postedBodyOf = ({ draftId }: KeyParams): string | null => posted.get(draftId) ?? null;

export const dropPosted = ({ draftId }: KeyParams): void => {
  posted.delete(draftId);
};

export const clearPosted = (): void => {
  posted.clear();
};
