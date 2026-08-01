import { format, formatWithCursor } from 'prettier';
import { describe, expect, it } from 'vitest';

import plugin from '../../src/index.js';

const longComment = `// ${Array.from({ length: 20 }, (_, index) => `word${index}`).join(' ')}`;

describe('offset-sensitive formatting', () => {
  it('preserves the cursor position by leaving comments unchanged', async () => {
    const targetIdentifier = 'targetIdentifier';
    const source = [
      longComment,
      'const first={alpha:1,beta:2};',
      `const ${targetIdentifier}={gamma:3,delta:4};`,
      '',
    ].join('\n');
    const cursorOffset = source.indexOf(targetIdentifier);
    const result = await formatWithCursor(source, {
      cursorOffset,
      parser: 'babel',
      plugins: [plugin],
      printWidth: 40,
    });

    expect(result.formatted).toContain(longComment);
    expect(result.cursorOffset).toBe(result.formatted.indexOf(targetIdentifier));
  });

  it('leaves comments and declarations outside a requested range unchanged', async () => {
    const targetDeclaration = 'const second={gamma:3};';
    const source = [longComment, 'const first={alpha:1,beta:2};', targetDeclaration, ''].join('\n');
    const rangeStart = source.indexOf(targetDeclaration);
    const options = {
      parser: 'babel' as const,
      printWidth: 40,
      rangeEnd: source.length,
      rangeStart,
    };
    const expected = await format(source, options);
    const result = await format(source, { ...options, plugins: [plugin] });

    expect(result).toBe(expected);
    expect(result).toContain(`${longComment}\nconst first={alpha:1,beta:2};`);
    expect(result).toContain('const second = { gamma: 3 };');
  });
});
