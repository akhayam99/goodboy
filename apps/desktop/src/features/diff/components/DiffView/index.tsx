import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefCallback,
} from 'react';
import { PageColumn, ScrollFade, Skeleton, type DiffLayoutMode } from '@goodboy/ui';
import type { FileDiff } from '@goodboy/types';
import { useDiffLayoutMode } from '../../../../shared/hooks/useDiffLayoutMode';
import { useDiffWrap } from '../../hooks/useDiffWrap';
import { DiffFile } from './DiffFile';
import { DisplayMenu } from './DisplayMenu';
import type { DiffComments, DiffFileActions, DiffThread, DiffViewed } from './types';

export type { DiffComments, DiffThread } from './types';

const BATCH_SIZE = 20;
const SETTLE_FRAMES = 30;
const STABLE_FRAMES = 3;
const USER_SCROLL_EVENTS = ['wheel', 'touchmove', 'pointerdown', 'keydown'] as const;

type Props = {
  readonly files: ReadonlyArray<FileDiff>;
  readonly comments?: DiffComments | null;
  readonly viewed?: DiffViewed | null;
  readonly fileActions?: DiffFileActions | null;
  readonly focusPath?: string | null;
  readonly onFocusHandled?: () => void;
  readonly registerScroller?: (scroll: ((path: string) => void) | null) => void;
  readonly onActivePathChange?: (path: string) => void;
  readonly presentation?: 'pane' | 'peek' | 'inline';
  readonly footer?: ReactNode;
  readonly fileCommentPath?: string | null;
  readonly onFileCommentOpened?: () => void;
  readonly toolbarStart?: ReactNode;
  readonly toolbarEnd?: ReactNode;
  readonly belowToolbar?: ReactNode;
  readonly columnWidth?: 'column' | 'full';
};

const EMPTY_THREADS: ReadonlyArray<DiffThread> = [];

const NOOP = () => undefined;

const matchPath = (files: ReadonlyArray<FileDiff>, path: string): string | null =>
  files.find((file) => file.path === path || path.endsWith(`/${file.path}`))?.path ?? null;

const offsetFromTop = (element: HTMLElement, viewport: HTMLElement | null): number =>
  element.getBoundingClientRect().top - (viewport?.getBoundingClientRect().top ?? 0);

const snapToTop = (element: HTMLElement) =>
  element.scrollIntoView?.({ block: 'start', behavior: 'instant' });

export const DiffView = ({
  files,
  comments = null,
  viewed = null,
  fileActions = null,
  focusPath = null,
  onFocusHandled,
  registerScroller,
  onActivePathChange,
  presentation = 'pane',
  footer,
  fileCommentPath = null,
  onFileCommentOpened = NOOP,
  toolbarStart,
  toolbarEnd,
  belowToolbar = null,
  columnWidth = 'column',
}: Props) => {
  const isPeek = presentation === 'peek';
  const [savedLayout, setLayout] = useDiffLayoutMode();
  const [savedWrap, setWrap] = useDiffWrap();
  const layout: DiffLayoutMode = isPeek ? 'unified' : savedLayout;
  const wrap = isPeek || savedWrap;
  const [mountedCount, setMountedCount] = useState(BATCH_SIZE);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set());
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const fileRefs = useRef(new Map<string, HTMLElement>());
  const refCallbacks = useRef(new Map<string, RefCallback<HTMLElement>>());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const pendingScroll = useRef<string | null>(null);
  const intersecting = useRef(new Set<string>());
  const lockedPath = useRef<string | null>(null);
  const settleFrame = useRef<number | null>(null);
  const focusFrame = useRef<number | null>(null);
  const onActivePathChangeRef = useRef(onActivePathChange);
  onActivePathChangeRef.current = onActivePathChange;
  const filesRef = useRef(files);
  filesRef.current = files;
  const pathsKey = useMemo(() => files.map((file) => file.path).join('\n'), [files]);

  const threadsByFile = useMemo(() => {
    const map = new Map<string, DiffThread[]>();
    for (const thread of comments?.threads ?? []) {
      const list = map.get(thread.filePath) ?? [];
      list.push(thread);
      map.set(thread.filePath, list);
    }
    return map;
  }, [comments?.threads]);

  useEffect(() => {
    if (activePath !== null) {
      onActivePathChangeRef.current?.(activePath);
    }
  }, [activePath]);

  const cancelSettle = useCallback(() => {
    if (settleFrame.current !== null) {
      cancelAnimationFrame(settleFrame.current);
      settleFrame.current = null;
    }
  }, []);

  const topFilePath = useCallback((): string | null => {
    const rootTop = viewportRef.current?.getBoundingClientRect().top ?? 0;
    for (const file of filesRef.current) {
      if (!intersecting.current.has(file.path)) {
        continue;
      }
      const element = fileRefs.current.get(file.path);
      if (element && element.getBoundingClientRect().bottom > rootTop + 1) {
        return file.path;
      }
    }
    return null;
  }, []);

  const syncActivePath = useCallback(() => {
    if (lockedPath.current !== null) {
      return;
    }
    const top = topFilePath();
    if (top !== null) {
      setActivePath(top);
    }
  }, [topFilePath]);

  useLayoutEffect(() => {
    lockedPath.current = null;
    intersecting.current = new Set();
    const pending = pendingScroll.current;
    const index =
      pending === null ? -1 : filesRef.current.findIndex((file) => file.path === pending);
    if (index < 0) {
      pendingScroll.current = null;
      setMountedCount(BATCH_SIZE);
      return;
    }
    setMountedCount(
      Math.min(Math.ceil((index + 1) / BATCH_SIZE) * BATCH_SIZE, filesRef.current.length),
    );
  }, [pathsKey]);

  useEffect(() => cancelSettle, [cancelSettle]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport === null) {
      return;
    }
    let frame: number | null = null;
    const release = () => {
      lockedPath.current = null;
      cancelSettle();
    };
    const onScroll = () => {
      if (lockedPath.current !== null || frame !== null) {
        return;
      }
      frame = requestAnimationFrame(() => {
        frame = null;
        syncActivePath();
      });
    };
    for (const name of USER_SCROLL_EVENTS) {
      viewport.addEventListener(name, release, { passive: true });
    }
    viewport.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      for (const name of USER_SCROLL_EVENTS) {
        viewport.removeEventListener(name, release);
      }
      viewport.removeEventListener('scroll', onScroll);
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [cancelSettle, syncActivePath]);

  useEffect(() => {
    if (mountedCount >= files.length) {
      return;
    }
    const schedule = typeof requestIdleCallback === 'function' ? requestIdleCallback : setTimeout;
    const cancel = typeof cancelIdleCallback === 'function' ? cancelIdleCallback : clearTimeout;
    const id = schedule(() =>
      setMountedCount((count) => Math.min(count + BATCH_SIZE, files.length)),
    );
    return () => cancel(id as number);
  }, [files.length, mountedCount]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(new Set(filesRef.current.map((file) => file.path)));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const nowSeen: string[] = [];
        for (const entry of entries) {
          const path = entry.target.getAttribute('data-file-path');
          if (path === null) {
            continue;
          }
          if (!entry.isIntersecting) {
            intersecting.current.delete(path);
            continue;
          }
          intersecting.current.add(path);
          nowSeen.push(path);
        }
        if (nowSeen.length > 0) {
          setSeen((current) => {
            if (nowSeen.every((path) => current.has(path))) {
              return current;
            }
            return new Set([...current, ...nowSeen]);
          });
        }
        syncActivePath();
      },
      { root: viewportRef.current, rootMargin: '400px 0px 0px 0px', threshold: 0 },
    );
    observerRef.current = observer;
    for (const element of fileRefs.current.values()) {
      observer.observe(element);
    }
    return () => {
      observer.disconnect();
      if (observerRef.current === observer) {
        observerRef.current = null;
      }
    };
  }, [pathsKey, syncActivePath]);

  const registerRef = useCallback((path: string): RefCallback<HTMLElement> => {
    const existing = refCallbacks.current.get(path);
    if (existing) {
      return existing;
    }
    const callback: RefCallback<HTMLElement> = (element) => {
      const previous = fileRefs.current.get(path);
      if (previous && previous !== element) {
        observerRef.current?.unobserve(previous);
      }
      if (element === null) {
        fileRefs.current.delete(path);
        return;
      }
      fileRefs.current.set(path, element);
      observerRef.current?.observe(element);
    };
    refCallbacks.current.set(path, callback);
    return callback;
  }, []);

  const anchorTo = useCallback(
    (path: string, element: HTMLElement) => {
      cancelSettle();
      lockedPath.current = path;
      setActivePath(path);
      snapToTop(element);
      let last = offsetFromTop(element, viewportRef.current);
      let frames = 0;
      let stable = 0;
      const tick = () => {
        const current = fileRefs.current.get(path);
        if (!current || lockedPath.current !== path) {
          settleFrame.current = null;
          return;
        }
        const offset = offsetFromTop(current, viewportRef.current);
        const settled =
          viewportRef.current === null ? Math.abs(offset - last) <= 1 : Math.abs(offset) <= 1;
        stable = settled ? stable + 1 : 0;
        if (!settled) {
          snapToTop(current);
        }
        last = offsetFromTop(current, viewportRef.current);
        frames += 1;
        if (stable >= STABLE_FRAMES || frames >= SETTLE_FRAMES) {
          settleFrame.current = null;
          return;
        }
        settleFrame.current = requestAnimationFrame(tick);
      };
      settleFrame.current = requestAnimationFrame(tick);
    },
    [cancelSettle],
  );

  const scrollToFile = useCallback(
    (path: string) => {
      const element = fileRefs.current.get(path);
      if (element) {
        anchorTo(path, element);
        return;
      }
      const index = filesRef.current.findIndex((file) => file.path === path);
      if (index < 0) {
        return;
      }
      pendingScroll.current = path;
      const needed = Math.min(
        Math.ceil((index + 1) / BATCH_SIZE) * BATCH_SIZE,
        filesRef.current.length,
      );
      setMountedCount((count) => Math.max(count, needed));
    },
    [anchorTo],
  );

  useEffect(() => {
    registerScroller?.(scrollToFile);
    return () => registerScroller?.(null);
  }, [registerScroller, scrollToFile]);

  useEffect(() => {
    const path = pendingScroll.current;
    if (path === null) {
      return;
    }
    const element = fileRefs.current.get(path);
    if (!element) {
      return;
    }
    pendingScroll.current = null;
    anchorTo(path, element);
  }, [anchorTo, mountedCount, pathsKey]);

  useEffect(
    () => () => {
      if (focusFrame.current !== null) {
        cancelAnimationFrame(focusFrame.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (focusPath === null || pathsKey === '') {
      return;
    }
    const target = matchPath(filesRef.current, focusPath);
    onFocusHandled?.();
    if (target === null) {
      return;
    }
    if (focusFrame.current !== null) {
      cancelAnimationFrame(focusFrame.current);
    }
    focusFrame.current = requestAnimationFrame(() => {
      focusFrame.current = null;
      scrollToFile(target);
    });
  }, [focusPath, onFocusHandled, pathsKey, scrollToFile]);

  const body = (
    <div className="flex flex-col gap-3 pb-6">
      {files.slice(0, mountedCount).map((file) => (
        <DiffFile
          key={file.path}
          file={file}
          layout={layout}
          wrap={wrap}
          threads={threadsByFile.get(file.path) ?? EMPTY_THREADS}
          comments={comments}
          viewed={viewed}
          fileActions={fileActions}
          registerRef={registerRef(file.path)}
          isVisible={seen.has(file.path)}
          wantsFileComment={fileCommentPath === file.path}
          onFileCommentOpened={onFileCommentOpened}
        />
      ))}
      {mountedCount < files.length ? (
        <div className="flex flex-col gap-2" aria-label="Loading more files">
          <Skeleton className="h-9 w-full rounded-md" />
          <span className="text-center text-meta tabular-nums text-muted-foreground">
            {mountedCount} of {files.length} files
          </span>
        </div>
      ) : null}
      {footer}
    </div>
  );

  if (isPeek) {
    return (
      <ScrollFade className="min-h-0 flex-1" viewportRef={viewportRef} fadeSize={24}>
        <div className="px-3 pt-1">{body}</div>
      </ScrollFade>
    );
  }

  const toolbar = (
    <div
      data-slot="diff-toolbar"
      className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
    >
      <div className="flex min-w-0 items-center gap-2">{toolbarStart}</div>
      <div className="flex shrink-0 items-center gap-2">
        <DisplayMenu layout={layout} onLayout={setLayout} wrap={wrap} onWrap={setWrap} />
        {toolbarEnd}
      </div>
    </div>
  );

  if (presentation === 'inline') {
    return (
      <div data-slot="diff-view" className="flex min-w-0 flex-col gap-3">
        {toolbar}
        {belowToolbar}
        {body}
      </div>
    );
  }

  return (
    <div data-slot="diff-view" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="shrink-0">
        <PageColumn width={columnWidth} className="flex flex-col gap-3 pb-3">
          {toolbar}
          {belowToolbar}
        </PageColumn>
      </div>
      <ScrollFade className="min-h-0 flex-1" viewportRef={viewportRef} fadeSize={24}>
        <PageColumn width={columnWidth}>{body}</PageColumn>
      </ScrollFade>
    </div>
  );
};
