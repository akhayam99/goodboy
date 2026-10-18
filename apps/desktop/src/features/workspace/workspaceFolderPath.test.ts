// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type IsoDateTime, type WorkspaceId } from '@goodboy/types';
import { aProject } from '@goodboy/types/testing';
import { folderCountLabel } from './folderCountLabel';
import { workspaceFolderPath } from './workspaceFolderPath';

const HARBORLINE = brandId<WorkspaceId>({ value: 'ws-harborline' });
const NORTHWIND = brandId<WorkspaceId>({ value: 'ws-northwind' });
const HOME = '/mock';

type FolderParams = {
  readonly rootPath: string;
  readonly workspaceId?: WorkspaceId;
  readonly isDisconnected?: boolean;
};

const folder = ({ rootPath, workspaceId = HARBORLINE, isDisconnected = false }: FolderParams) =>
  aProject({
    workspaceId,
    rootPath,
    ...(isDisconnected && {
      disconnectedAt: brandId<IsoDateTime>({ value: '2026-10-17T09:00:00.000Z' }),
    }),
  });

describe('workspaceFolderPath', () => {
  it('names the one folder of a workspace from the home folder', () => {
    const projects = [folder({ rootPath: '/mock/Code/acme-web' })];

    expect(workspaceFolderPath({ projects, workspaceId: HARBORLINE, home: HOME })).toBe(
      '~/Code/acme-web',
    );
  });

  it('names the folder that holds every repository of a workspace', () => {
    const projects = ['payments-api', 'ledger-core', 'notify-relay'].map((name) =>
      folder({ rootPath: `/mock/Code/harborline/${name}` }),
    );

    expect(workspaceFolderPath({ projects, workspaceId: HARBORLINE, home: HOME })).toBe(
      '~/Code/harborline',
    );
  });

  it('falls back to the primary folder when the folders share only the home folder', () => {
    const projects = [
      folder({ rootPath: '/mock/Code/ledger-core' }),
      folder({ rootPath: '/mock/Work/notify-relay' }),
    ];

    expect(workspaceFolderPath({ projects, workspaceId: HARBORLINE, home: HOME })).toMatch(
      /^~\/(Code\/ledger-core|Work\/notify-relay)$/,
    );
  });

  it('keeps an absolute path while the home folder is unknown', () => {
    const projects = [folder({ rootPath: '/mock/Code/acme-web' })];

    expect(workspaceFolderPath({ projects, workspaceId: HARBORLINE, home: null })).toBe(
      '/mock/Code/acme-web',
    );
  });

  it('reads only the folders of the workspace it names, and none that are disconnected', () => {
    const projects = [
      folder({ rootPath: '/mock/Code/acme-web' }),
      folder({ rootPath: '/mock/Code/payments-api', workspaceId: NORTHWIND }),
      folder({ rootPath: '/mock/Old/ledger-core', isDisconnected: true }),
    ];

    expect(workspaceFolderPath({ projects, workspaceId: HARBORLINE, home: HOME })).toBe(
      '~/Code/acme-web',
    );
    expect(workspaceFolderPath({ projects: [], workspaceId: HARBORLINE, home: HOME })).toBeNull();
  });
});

describe('folderCountLabel', () => {
  it('says folders, one or many, and skips disconnected ones', () => {
    const projects = [
      folder({ rootPath: '/mock/Code/acme-web' }),
      folder({ rootPath: '/mock/Code/acme-api' }),
      folder({ rootPath: '/mock/Old/ledger-core', isDisconnected: true }),
      folder({ rootPath: '/mock/Code/payments-api', workspaceId: NORTHWIND }),
    ];

    expect(folderCountLabel({ projects, workspaceId: HARBORLINE })).toBe('2 folders');
    expect(folderCountLabel({ projects, workspaceId: NORTHWIND })).toBe('1 folder');
    expect(folderCountLabel({ projects, workspaceId: null })).toBe('0 folders');
  });
});
