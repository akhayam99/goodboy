import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { stripComments } from '../src/server/stripComments.ts';
import { themePictures } from '../src/server/themePictures.ts';

const strip = (source) => stripComments({ source });

describe('stripComments', () => {
  it('removes a whole comment', () => {
    assert.equal(strip('a <!-- gb area=review --> b'), 'a  b');
  });

  it('ends a comment at --!> as well as -->', () => {
    assert.equal(strip('a<!-- x --!>b<!-- y -->c'), 'abc');
  });

  it('ends an abrupt comment at its first >', () => {
    assert.equal(strip('a<!-->b<!--->c'), 'abc');
  });

  it('leaves no opener behind when comments overlap or nest', () => {
    const cases = ['<!<!---->--> x', '<!--<!---->-->y', '<<!--!---->z', '<!<!-- x -->--> y'];
    cases.forEach((source) => assert.ok(!strip(source).includes('<!--'), source));
  });

  it('drops the opener of an unterminated comment and keeps the text', () => {
    assert.equal(strip('keep <!-- this'), 'keep  this');
  });

  it('leaves text without comments alone', () => {
    assert.equal(strip('a -> b, c --> d'), 'a -> b, c --> d');
  });
});

describe('themePictures', () => {
  const picture = [
    '<picture>',
    '  <source media="(prefers-color-scheme: dark)" srcset="https://example.test/dark.webp">',
    '  <img src="https://example.test/light.webp" width="480" alt="The board">',
    '</picture>',
  ].join('\n');

  it('renders one image per site theme', () => {
    const html = themePictures({ html: `before ${picture} after` });
    assert.match(
      html,
      /^before <img class="themeImage light" src="https:\/\/example.test\/light.webp"/,
    );
    assert.match(html, /<img class="themeImage dark" src="https:\/\/example.test\/dark.webp"/);
    assert.equal(html.match(/alt="The board"/g)?.length, 2);
    assert.equal(html.match(/width="480"/g)?.length, 2);
    assert.equal(html.match(/loading="lazy"/g)?.length, 2);
    assert.ok(!html.includes('<picture') && !html.includes('prefers-color-scheme'));
    assert.ok(html.endsWith(' after'));
  });

  it('keeps a picture that is not a light and dark pair', () => {
    const other = picture.replace('(prefers-color-scheme: dark)', '(min-width: 800px)');
    assert.equal(themePictures({ html: other }), other);
  });
});
