import { describe, expect, it } from 'vitest';

import { collectLineCommentGroup } from '../../../src/comments/line-comment-groups.js';
import { createCommentRange } from '../support/comments.js';

describe('collectLineCommentGroup', () => {
  it('returns an empty group when the start index has no comment', () => {
    expect(collectLineCommentGroup('', [], 3, 2)).toEqual({ comments: [], endIndex: 3 });
  });

  it('collects adjacent eligible line comments at the same display column', () => {
    const text = ['\t// first', '  // second', '  // third'].join('\n');
    const comments = [
      createCommentRange(text, '// first'),
      createCommentRange(text, '// second'),
      createCommentRange(text, '// third'),
    ];

    expect(collectLineCommentGroup(text, comments, 0, 2)).toEqual({ comments, endIndex: 2 });
  });

  it('stops before comments that do not belong to the group', () => {
    const cases = [
      {
        comments: ['// first', '/* second */'],
        name: 'block comment',
        text: ['// first', '/* second */'].join('\n'),
      },
      {
        comments: ['// first', '// second'],
        name: 'trailing line comment',
        text: ['// first', 'value(); // second'].join('\n'),
      },
      {
        comments: ['// first', '// eslint-disable-next-line'],
        name: 'directive comment',
        text: ['// first', '// eslint-disable-next-line'].join('\n'),
      },
      {
        comments: ['// first', '// $FlowFixMe[incompatible-type]'],
        name: 'Flow suppression comment',
        text: ['// first', '// $FlowFixMe[incompatible-type]'].join('\n'),
      },
      {
        comments: ['// first', '// flowlint-next-line sketchy-null-bool:off'],
        name: 'Flow lint comment',
        text: ['// first', '// flowlint-next-line sketchy-null-bool:off'].join('\n'),
      },
      {
        comments: ['// first', '/// <reference path="types.d.ts" />'],
        name: 'triple-slash comment',
        text: ['// first', '/// <reference path="types.d.ts" />'].join('\n'),
      },
      {
        comments: ['// first', '// second'],
        name: 'blank line',
        text: ['// first', '', '// second'].join('\n'),
      },
      {
        comments: ['// first', '// second'],
        name: 'different marker column',
        text: ['// first', ' // second'].join('\n'),
      },
    ];

    for (const testCase of cases) {
      const comments = [
        createCommentRange(testCase.text, testCase.comments[0] ?? ''),
        createCommentRange(testCase.text, testCase.comments[1] ?? ''),
      ];

      expect(collectLineCommentGroup(testCase.text, comments, 0, 2), testCase.name).toEqual({
        comments: [comments[0]],
        endIndex: 0,
      });
    }
  });
});
