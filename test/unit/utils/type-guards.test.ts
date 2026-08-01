import { describe, expect, it } from 'vitest';

import { isRecord, numberOrUndefined } from '../../../src/utils/type-guards.js';

describe('isRecord', () => {
  it('accepts objects and arrays', () => {
    expect(isRecord({ value: 1 })).toBe(true);
    expect(isRecord([])).toBe(true);
  });

  it('rejects null and nonobject values', () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord('value')).toBe(false);
    expect(isRecord(1)).toBe(false);
    expect(isRecord(() => undefined)).toBe(false);
  });
});

describe('numberOrUndefined', () => {
  it('returns numbers without coercion', () => {
    expect(numberOrUndefined(0)).toBe(0);
    expect(numberOrUndefined(-3.5)).toBe(-3.5);
  });

  it('rejects nonnumeric values', () => {
    expect(numberOrUndefined('3')).toBeUndefined();
    expect(numberOrUndefined(null)).toBeUndefined();
    expect(numberOrUndefined({ value: 3 })).toBeUndefined();
  });
});
