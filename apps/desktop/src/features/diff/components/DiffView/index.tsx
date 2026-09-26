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
import { PageColumn, ScrollFade, Skeleton, useDropdown, type DiffLayoutMode } from '@goodboy/ui';
import type { FileDiff } from '@goodboy/types';
import { useDiffLayoutMode } from '../../../../shared/hooks/useDiffLayoutMode';
import { useDiffWrap } from '../../hooks/useDiffWrap';
import { DiffFile } from './DiffFile';
import { DiffToolbar } from './DiffToolbar';
import type { DiffComments, DiffFileActions, DiffThread, DiffViewed } from './types';

export type { DiffComments, DiffThread } from './types';

const BATCH_SIZE = 20;

type Props = {
  readonly files: ReadonlyArray<FileDiff>;
  readonly comments?: DiffComments | null;
  readonly viewed?: DiffViewed | null;
  readonly fileActions?: DiffFileActions | null;
  readonly focusPath?: string | null;
  readonly onFocusHandled?: () => void;
  readonly presentation?: 'pane' | 'peek' | 'inline';
  readonly footer?: ReactNode;
  readonly toolbarEnd?: ReactNode;
};

const EMPTY_THREADS: ReadonlyArray<DiffThread> = [];

const matchPath = (files: ReadonlyArray<FileDiff>, path: string): string | null =>
  files.find((file) => file.path === path || path.endsWith(`/${file.path}`))?.path ?? null;

const isTypingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT');

export const DiffView = ({
  files,
  comments = null,
  viewed = null,
  fileActions = null,
  focusPath = null,
  onFocusHandled,
  presentation = 'pane',
  footer,
  toolbarEnd,
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
  const jump = useDropdown({
    align: 'start',
    width: 'w-[420px] max-w-[calc(100vw-2rem)]',
    expectedHeight: 380,
    expectedWidth: 420,
  });

  const threadsByFile = useMemo(() => {
    const map = new Map<string, DiffThread[]>();
    for (const thread of comments?.threads ?? []) {
      const list = map.get(thread.filePath) ?? [];
      list.push(thread);
      map.set(thread.filePath, list);
    }
    return map;
  }, [comments?.threads]);

  const commentCountOf = useCallback(
    (path: string) => (threadsByFile.get(path) ?? []).filter((thread) => !thread.isResolved).length,
    [threadsByFile],
  );
  const isViewed = useCallback((file: FileDiff) => viewed?.stateOf(file) === 'viewed', [viewed]);
  const viewedCount = viewed === null ? null : files.filter(isViewed).length;

  useLayoutEffect(() => {
    pendingScroll.current = null;
    setMountedCount(BATCH_SIZE);
  }, [files]);

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
      setSeen(new Set(files.map((file) => file.path)));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const nowSeen: string[] = [];
        let top: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }
          const path = entry.target.getAttribute('data-file-path');
          if (path !== null) {
            nowSeen.push(path);
          }
          if (top === null || entry.boundingClientRect.top < top.boundingClientRect.top) {
            top = entry;
          }
        }
        if (nowSeen.length > 0) {
          setSeen((current) => {
            if (nowSeen.every((path) => current.has(path))) {
              return current;
            }
            return new Set([...current, ...nowSeen]);
          });
        }
        const topPath = top?.target.getAttribute('data-file-path') ?? null;
        if (topPath !== null) {
          setActivePath(topPath);
        }
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
  }, [files]);

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

  const scrollToFile = useCallback(
    (path: string) => {
      const element = fileRefs.current.get(path);
      if (element) {
        element.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
        setActivePath(path);
        return;
      }
      const index = files.findIndex((file) => file.path === path);
      if (index < 0) {
        return;
      }
      pendingScroll.current = path;
      const needed = Math.min(Math.ceil((index + 1) / BATCH_SIZE) * BATCH_SIZE, files.length);
      setMountedCount((count) => Math.max(count, needed));
    },
    [files],
  );

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
    element.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    setActivePath(path);
  }, [mountedCount]);

  useEffect(() => {
    if (focusPath === null || files.length === 0) {
      return;
    }
    const target = matchPath(files, focusPath);
    onFocusHandled?.();
    if (target === null) {
      return;
    }
    const frame = requestAnimationFrame(() => scrollToFile(target));
    return () => cancelAnimationFrame(frame);
  }, [files, focusPath, onFocusHandled, scrollToFile]);

  const step = useCallback(
    (delta: number) => {
      if (files.length === 0) {
        return;
      }
      const index = files.findIndex((file) => file.path === activePath);
      const next = Math.min(files.length - 1, Math.max(0, (index < 0 ? 0 : index) + delta));
      const target = files[next];
      if (target) {
        scrollToFile(target.path);
      }
    },
    [activePath, files, scrollToFile],
  );

  const toggleJump = jump.toggle;

  useEffect(() => {
    if (presentation !== 'pane') {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) {
        return;
      }
      if (event.code === 'KeyT' && !event.shiftKey) {
        event.preventDefault();
        toggleJump();
        return;
      }
      if (event.code === 'BracketLeft') {
        event.preventDefault();
        step(-1);
        return;
      }
      if (event.code === 'BracketRight') {
        event.preventDefault();
        step(1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [presentation, toggleJump, step]);

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
        />
      ))}
      {mountedCount < files.length ? (
        <div className="flex flex-col gap-2" aria-label="Loading more files">
          <Skeleton className="h-9 w-full rounded-md" />
          <span className="text-center text-secondary tabular-nums text-muted-foreground">
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
    <DiffToolbar
      files={files}
      activePath={activePath}
      jump={jump}
      onJump={scrollToFile}
      commentCountOf={commentCountOf}
      isViewed={isViewed}
      viewedCount={viewedCount}
      layout={layout}
      onLayout={setLayout}
      wrap={wrap}
      onWrap={setWrap}
      end={toolbarEnd}
    />
  );

  if (presentation === 'inline') {
    return (
      <div data-slot="diff-view" className="flex min-w-0 flex-col gap-3">
        {toolbar}
        {body}
      </div>
    );
  }

  return (
    <div data-slot="diff-view" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="shrink-0 [scrollbar-gutter:stable]">
        <PageColumn className="pb-3">{toolbar}</PageColumn>
      </div>
      <ScrollFade
        className="min-h-0 flex-1"
        viewportRef={viewportRef}
        viewportClassName="[scrollbar-gutter:stable]"
        fadeSize={24}
      >
        <PageColumn>{body}</PageColumn>
      </ScrollFade>
    </div>
  );
};
