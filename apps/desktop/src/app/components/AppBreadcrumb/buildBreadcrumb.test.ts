import { describe, it, expect, vi } from 'vitest';
import { buildBreadcrumb } from './buildBreadcrumb';
import type { BreadcrumbHandlers, BreadcrumbInput } from './buildBreadcrumb';

const makeHandlers = (): BreadcrumbHandlers => ({
  toOverview: vi.fn(),
  toWorkspaceLauncher: vi.fn(),
  toWorkspaceBoard: vi.fn(),
});

const ws = { id: 'ws-1', name: 'My Repo' };
const sess = { id: 'sess-1', label: 'fix login bug' };

const ids = (crumbs: ReturnType<typeof buildBreadcrumb>) => crumbs.map((c) => c.id);
const labels = (crumbs: ReturnType<typeof buildBreadcrumb>) => crumbs.map((c) => c.label);
const lastClickable = (crumbs: ReturnType<typeof buildBreadcrumb>) =>
  crumbs[crumbs.length - 1]?.onClick;

describe('buildBreadcrumb', () => {
  describe('chrome: workspace-launcher', () => {
    it('produces Overview > Workspace trail', () => {
      const h = makeHandlers();
      const crumbs = buildBreadcrumb({
        workspace: ws,
        session: null,
        chrome: { kind: 'workspace-launcher' },
        handlers: h,
      });
      expect(labels(crumbs)).toEqual(['Overview', 'Workspace']);
      expect(ids(crumbs)).toEqual(['overview', 'workspace']);
    });

    it('last crumb has no onClick', () => {
      const h = makeHandlers();
      const crumbs = buildBreadcrumb({
        workspace: ws,
        session: null,
        chrome: { kind: 'workspace-launcher' },
        handlers: h,
      });
      expect(lastClickable(crumbs)).toBeUndefined();
    });

    it('Overview fires toOverview', () => {
      const h = makeHandlers();
      const crumbs = buildBreadcrumb({
        workspace: ws,
        session: null,
        chrome: { kind: 'workspace-launcher' },
        handlers: h,
      });
      crumbs[0]!.onClick!();
      expect(h.toOverview).toHaveBeenCalledOnce();
    });
  });

  describe('chrome: workspace-create', () => {
    it('produces Overview > Workspace > Create trail', () => {
      const h = makeHandlers();
      const crumbs = buildBreadcrumb({
        workspace: null,
        session: null,
        chrome: { kind: 'workspace-create' },
        handlers: h,
      });
      expect(labels(crumbs)).toEqual(['Overview', 'Workspace', 'Create']);
      expect(ids(crumbs)).toEqual(['overview', 'workspace', 'create']);
    });

    it('last crumb has no onClick', () => {
      const h = makeHandlers();
      const crumbs = buildBreadcrumb({
        workspace: null,
        session: null,
        chrome: { kind: 'workspace-create' },
        handlers: h,
      });
      expect(lastClickable(crumbs)).toBeUndefined();
    });

    it('Workspace crumb fires toWorkspaceLauncher', () => {
      const h = makeHandlers();
      const crumbs = buildBreadcrumb({
        workspace: null,
        session: null,
        chrome: { kind: 'workspace-create' },
        handlers: h,
      });
      crumbs[1]!.onClick!();
      expect(h.toWorkspaceLauncher).toHaveBeenCalledOnce();
    });
  });

  describe('chrome: pull-request', () => {
    it('produces Overview > PullRequest > Comments', () => {
      const h = makeHandlers();
      const crumbs = buildBreadcrumb({
        workspace: ws,
        session: null,
        chrome: { kind: 'pull-request', view: 'comments' },
        handlers: h,
      });
      expect(labels(crumbs)).toEqual(['Overview', 'PullRequest', 'Comments']);
      expect(ids(crumbs)).toEqual(['overview', 'pr', 'pr-comments']);
    });

    it('last crumb has no onClick', () => {
      const h = makeHandlers();
      const crumbs = buildBreadcrumb({
        workspace: ws,
        session: null,
        chrome: { kind: 'pull-request', view: 'comments' },
        handlers: h,
      });
      expect(lastClickable(crumbs)).toBeUndefined();
    });
  });

  describe('chrome: none', () => {
    describe('with session', () => {
      it('produces Overview > Workspace > {ws.name} > {session.label}', () => {
        const h = makeHandlers();
        const crumbs = buildBreadcrumb({
          workspace: ws,
          session: sess,
          chrome: { kind: 'none' },
          handlers: h,
        });
        expect(labels(crumbs)).toEqual(['Overview', 'Workspace', ws.name, sess.label]);
        expect(ids(crumbs)).toEqual(['overview', 'workspace', 'workspace-name', 'session']);
      });

      it('Workspace fires toWorkspaceLauncher, ws.name fires toWorkspaceBoard', () => {
        const h = makeHandlers();
        const crumbs = buildBreadcrumb({
          workspace: ws,
          session: sess,
          chrome: { kind: 'none' },
          handlers: h,
        });
        crumbs[1]!.onClick!();
        expect(h.toWorkspaceLauncher).toHaveBeenCalledOnce();
        crumbs[2]!.onClick!();
        expect(h.toWorkspaceBoard).toHaveBeenCalledOnce();
      });

      it('last crumb (session) has no onClick', () => {
        const h = makeHandlers();
        const crumbs = buildBreadcrumb({
          workspace: ws,
          session: sess,
          chrome: { kind: 'none' },
          handlers: h,
        });
        expect(lastClickable(crumbs)).toBeUndefined();
      });
    });

    describe('with workspace only (no session)', () => {
      it('produces Overview > Workspace > {ws.name}', () => {
        const h = makeHandlers();
        const crumbs = buildBreadcrumb({
          workspace: ws,
          session: null,
          chrome: { kind: 'none' },
          handlers: h,
        });
        expect(labels(crumbs)).toEqual(['Overview', 'Workspace', ws.name]);
        expect(ids(crumbs)).toEqual(['overview', 'workspace', 'workspace-name']);
      });

      it('last crumb has no onClick', () => {
        const h = makeHandlers();
        const crumbs = buildBreadcrumb({
          workspace: ws,
          session: null,
          chrome: { kind: 'none' },
          handlers: h,
        });
        expect(lastClickable(crumbs)).toBeUndefined();
      });

      it('Workspace fires toWorkspaceLauncher', () => {
        const h = makeHandlers();
        const crumbs = buildBreadcrumb({
          workspace: ws,
          session: null,
          chrome: { kind: 'none' },
          handlers: h,
        });
        crumbs[1]!.onClick!();
        expect(h.toWorkspaceLauncher).toHaveBeenCalledOnce();
      });
    });

    describe('with no workspace and no session', () => {
      it('produces only Overview', () => {
        const h = makeHandlers();
        const crumbs = buildBreadcrumb({
          workspace: null,
          session: null,
          chrome: { kind: 'none' },
          handlers: h,
        });
        expect(labels(crumbs)).toEqual(['Overview']);
        expect(ids(crumbs)).toEqual(['overview']);
      });

      it('Overview has no onClick (single crumb = last)', () => {
        const h = makeHandlers();
        const crumbs = buildBreadcrumb({
          workspace: null,
          session: null,
          chrome: { kind: 'none' },
          handlers: h,
        });
        expect(lastClickable(crumbs)).toBeUndefined();
      });
    });
  });
});
