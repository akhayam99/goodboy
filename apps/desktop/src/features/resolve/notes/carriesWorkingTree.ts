import { noteIdOfThread } from './noteThread';

type Params = { readonly threadIds: ReadonlyArray<string> };

export const carriesWorkingTree = ({ threadIds }: Params): boolean =>
  threadIds.some((threadId) => noteIdOfThread({ threadId }) !== null);
