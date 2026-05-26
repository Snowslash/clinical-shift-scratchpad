import { describe, expect, it } from 'vitest';
import { insertLeadingSexShortcut, insertTextShortcut } from './textShortcuts';

describe('insertLeadingSexShortcut', () => {
  it('adds the selected sex prefix to an empty note', () => {
    expect(insertLeadingSexShortcut('', 'M')).toBe('M');
    expect(insertLeadingSexShortcut('', 'F')).toBe('F');
  });

  it('adds the selected sex prefix before existing note text without removing content', () => {
    expect(insertLeadingSexShortcut('60 abdo pain + vomiting', 'M')).toBe('M60 abdo pain + vomiting');
    expect(insertLeadingSexShortcut('  82 fall', 'F')).toBe('F82 fall');
  });

  it('does not duplicate a leading sex prefix when the note already starts with M or F followed by age', () => {
    expect(insertLeadingSexShortcut('M60 abdo pain', 'M')).toBe('M60 abdo pain');
    expect(insertLeadingSexShortcut('F82 fall', 'F')).toBe('F82 fall');
  });

  it('replaces the opposite leading sex prefix when used as a quick correction', () => {
    expect(insertLeadingSexShortcut('M60 abdo pain', 'F')).toBe('F60 abdo pain');
    expect(insertLeadingSexShortcut('F82 fall', 'M')).toBe('M82 fall');
  });
});

describe('insertTextShortcut', () => {
  it('appends non-sex job note shortcuts with sensible spacing', () => {
    expect(insertTextShortcut('', 'abdo pain')).toBe('abdo pain');
    expect(insertTextShortcut('M60', 'abdo pain')).toBe('M60 abdo pain');
    expect(insertTextShortcut('M60 ', 'abdo pain')).toBe('M60 abdo pain');
  });

  it('keeps sex shortcuts as leading prefixes rather than appended text', () => {
    expect(insertTextShortcut('60 abdo pain', 'M')).toBe('M60 abdo pain');
    expect(insertTextShortcut('M60 abdo pain', 'F')).toBe('F60 abdo pain');
  });
});
