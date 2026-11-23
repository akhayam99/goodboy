import { countNoun } from '../../utils/countNoun';
import type { DropFailureCause } from './dropFailureCauseOf';

export type GroupedCause = Exclude<DropFailureCause, 'too-large'>;

type OneParams = {
  readonly name: string;
};

type ManyParams = {
  readonly files: string;
};

type Copy = {
  readonly one: (params: OneParams) => string;
  readonly many: (params: ManyParams) => string;
};

type Params = {
  readonly cause: GroupedCause;
  readonly names: ReadonlyArray<string>;
};

const COPY = {
  gone: {
    one: ({ name }) =>
      `${name} was moved or deleted before it could be read. Drop the saved file or use Attach files.`,
    many: ({ files }) =>
      `${files} were moved or deleted before they could be read. Drop the saved files or use Attach files.`,
  },
  denied: {
    one: ({ name }) => `Goodboy has no permission to read ${name}. Use Attach files to pick it.`,
    many: ({ files }) =>
      `Goodboy has no permission to read ${files}. Use Attach files to pick them.`,
  },
  unsupported: {
    one: ({ name }) =>
      `${name} can't be attached. Use Attach files to pick an image, PDF, CSV or text file.`,
    many: ({ files }) =>
      `${files} can't be attached. Use Attach files to pick images, PDFs, CSV or text files.`,
  },
  unknown: {
    one: ({ name }) => `Couldn't attach ${name}. Drop it again or use Attach files.`,
    many: ({ files }) => `Couldn't attach ${files}. Drop them again or use Attach files.`,
  },
} as const satisfies Record<GroupedCause, Copy>;

export const dropFailureNotice = ({ cause, names }: Params): string => {
  const copy = COPY[cause];
  const [only] = names;
  if (names.length === 1 && only !== undefined) {
    return copy.one({ name: only });
  }
  return copy.many({ files: countNoun({ count: names.length, one: 'file' }) });
};
