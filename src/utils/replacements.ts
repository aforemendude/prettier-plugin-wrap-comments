export type Replacement = {
  end: number;
  start: number;
  text: string;
};

export function applyReplacements(text: string, replacements: Replacement[]): string {
  let result = text;

  for (const replacement of getNonOverlappingReplacements(replacements).sort(
    (left, right) => right.start - left.start,
  )) {
    result = result.slice(0, replacement.start) + replacement.text + result.slice(replacement.end);
  }

  return result;
}

function getNonOverlappingReplacements(replacements: Replacement[]): Replacement[] {
  return [...replacements]
    .sort((left, right) => left.start - right.start || right.end - left.end)
    .reduce<Replacement[]>((accepted, replacement) => {
      const previous = accepted.at(-1);

      if (previous === undefined || !rangesOverlap(previous, replacement)) {
        accepted.push(replacement);
      }

      return accepted;
    }, []);
}

function rangesOverlap(left: Replacement, right: Replacement): boolean {
  return left.start < right.end && right.start < left.end;
}
