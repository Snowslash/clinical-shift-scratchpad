export type SexShortcut = 'M' | 'F';

const leadingSexAndAgePattern = /^\s*([MF])(\d)/i;

export function isSexShortcut(value: string): value is SexShortcut {
  return value === 'M' || value === 'F';
}

export function insertLeadingSexShortcut(text: string, sex: SexShortcut): string {
  const trimmedStart = text.trimStart();
  const existing = leadingSexAndAgePattern.exec(trimmedStart);

  if (existing) {
    return `${sex}${trimmedStart.slice(1)}`;
  }

  return `${sex}${trimmedStart}`;
}

export function insertTextShortcut(text: string, shortcut: string): string {
  if (isSexShortcut(shortcut)) {
    return insertLeadingSexShortcut(text, shortcut);
  }

  const cleanShortcut = shortcut.trim();
  if (!cleanShortcut) return text;

  const trimmedEnd = text.trimEnd();
  if (!trimmedEnd) return cleanShortcut;

  return `${trimmedEnd} ${cleanShortcut}`;
}
