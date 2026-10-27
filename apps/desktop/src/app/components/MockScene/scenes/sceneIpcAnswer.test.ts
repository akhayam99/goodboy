import { describe, expect, it } from 'vitest';
import { sceneIpcAnswer } from './sceneIpcAnswer';

const NO_ANSWER = () => null;

describe('sceneIpcAnswer', () => {
  it('answers the folder size with every field the real command sends', () => {
    const answer = sceneIpcAnswer({ handler: NO_ANSWER })('file_versions_folder_size', {});

    expect(Object.keys(Object(answer)).sort()).toEqual([
      'capBytes',
      'fileCount',
      'folderPath',
      'isReady',
      'keptBytes',
      'versionBytes',
      'versionCount',
    ]);
  });

  it('keeps the answer a scene gives', () => {
    const handler = () => ({ capBytes: 1 });

    expect(sceneIpcAnswer({ handler })('file_versions_folder_size', {})).toEqual({ capBytes: 1 });
  });
});
