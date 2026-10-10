import { useCallback, useEffect, useRef, useState } from 'react';
import { exploreList } from '../../explore';
import { EXPLORE_ROOT_PATH, type ExploreListing } from '../../exploreRows';

type Params = {
  readonly sessionDir: string | null;
};

type LoadParams = {
  readonly relPath: string;
};

type ReloadParams = {
  readonly relPaths: ReadonlyArray<string>;
};

export type ExploreListingControls = {
  readonly listing: ExploreListing;
  readonly load: (params: LoadParams) => Promise<void>;
  readonly reload: (params: ReloadParams) => void;
};

const MISSING_DIR = 'Session folder is not available yet.';

const hasDir = (sessionDir: string | null): sessionDir is string =>
  sessionDir !== null && sessionDir.trim() !== '';

const initialListing = ({ sessionDir }: Params): ExploreListing =>
  hasDir(sessionDir)
    ? { entriesByPath: {}, loadingByPath: { [EXPLORE_ROOT_PATH]: true }, errorByPath: {} }
    : {
        entriesByPath: {},
        loadingByPath: {},
        errorByPath: { [EXPLORE_ROOT_PATH]: MISSING_DIR },
      };

const reasonOf = (error: unknown): string => {
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message;
  }
  return 'Unknown error';
};

export const useExploreListing = ({ sessionDir }: Params): ExploreListingControls => {
  const [listing, setListing] = useState<ExploreListing>(() => initialListing({ sessionDir }));
  const generation = useRef(0);
  const latestByPath = useRef(new Map<string, number>());
  const counter = useRef(0);

  const load = useCallback(
    async ({ relPath }: LoadParams) => {
      if (!hasDir(sessionDir)) {
        return;
      }
      const owner = generation.current;
      counter.current += 1;
      const ticket = counter.current;
      latestByPath.current.set(relPath, ticket);
      const isCurrent = () =>
        generation.current === owner && latestByPath.current.get(relPath) === ticket;
      setListing((previous) => ({
        ...previous,
        loadingByPath: { ...previous.loadingByPath, [relPath]: true },
        errorByPath: { ...previous.errorByPath, [relPath]: null },
      }));
      try {
        const entries = await exploreList({ sessionDir, relPath });
        if (!isCurrent()) {
          return;
        }
        setListing((previous) => ({
          entriesByPath: { ...previous.entriesByPath, [relPath]: entries },
          loadingByPath: { ...previous.loadingByPath, [relPath]: false },
          errorByPath: previous.errorByPath,
        }));
      } catch (error) {
        if (!isCurrent()) {
          return;
        }
        setListing((previous) => ({
          ...previous,
          loadingByPath: { ...previous.loadingByPath, [relPath]: false },
          errorByPath: { ...previous.errorByPath, [relPath]: reasonOf(error) },
        }));
      }
    },
    [sessionDir],
  );

  useEffect(() => {
    generation.current += 1;
    latestByPath.current = new Map();
    setListing(initialListing({ sessionDir }));
    if (hasDir(sessionDir)) {
      void load({ relPath: EXPLORE_ROOT_PATH });
    }
  }, [load, sessionDir]);

  const reload = useCallback(
    ({ relPaths }: ReloadParams) => {
      for (const relPath of relPaths) {
        void load({ relPath });
      }
    },
    [load],
  );

  return { listing, load, reload };
};
