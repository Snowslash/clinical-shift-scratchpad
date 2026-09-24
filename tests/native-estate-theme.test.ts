/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { select: (options: Record<string, unknown>) => options.ios },
  StyleSheet: { create: (styles: unknown) => styles },
}));

import * as nativeTheme from '../src/theme';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const contract = readFileSync(require.resolve('@sangeev/estate-ui/contract.css'), 'utf8');
const declarations = (block: string) => Object.fromEntries(
  [...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]),
);
const lightTokens = declarations(contract.match(/:root\s*\{([^}]+)\}/)![1]);
const darkTokens = { ...lightTokens, ...declarations(contract.match(/\[data-theme="dark"\],\s*\.dark\s*\{([^}]+)\}/)![1]) };
const resolve = (tokens: Record<string, string>, name: string): string => {
  const value = tokens[name];
  if (!value) throw new Error(`Missing estate token: ${name}`);
  const reference = value.match(/^var\(--([\w-]+)\)$/);
  return reference ? resolve(tokens, reference[1]) : value;
};

const luminance = (hex: string) => {
  const channels = hex.replace('#', '').match(/../g)!.map((part) => parseInt(part, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (foreground: string, background: string) => {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

for (const [mode, theme, tokens] of [
  ['light', nativeTheme.lightTheme, lightTokens],
  ['dark', nativeTheme.darkTheme, darkTokens],
] as const) {
  describe(`${mode} native estate colours`, () => {
    it('uses the exact pinned estate semantic roles, not a near-match palette', () => {
      expect(theme).toMatchObject({
        background: resolve(tokens, 'background'),
        card: resolve(tokens, 'card'),
        text: resolve(tokens, 'foreground'),
        muted: resolve(tokens, 'muted-foreground'),
        border: resolve(tokens, 'border'),
        placeholder: resolve(tokens, 'muted-foreground'),
        primary: resolve(tokens, 'primary'),
        primaryText: resolve(tokens, 'primary-foreground'),
        destructive: resolve(tokens, 'destructive'),
        undoBackground: resolve(tokens, 'card'),
        secondaryActionBackground: resolve(tokens, 'secondary'),
        secondaryActionText: resolve(tokens, 'secondary-foreground'),
      });
    });

    it('pairs every primary action and selected control with the theme foreground', () => {
      expect(nativeTheme).toHaveProperty('stylesForTheme');
      const styles = (nativeTheme as any).stylesForTheme(theme);
      for (const name of ['primaryButton', 'primaryButtonLarge', 'bottomAddButton', 'modalSaveButton', 'undoButton', 'tabActive', 'filterChipActive', 'typeChipActive', 'toggleButtonActive']) {
        expect(styles[name].backgroundColor, name).toBe(resolve(tokens, 'primary'));
      }
      for (const name of ['primaryButtonText', 'modalSaveText', 'undoButtonText']) {
        expect(styles[name].color, name).toBe(resolve(tokens, 'primary-foreground'));
        expect(contrast(styles[name].color, resolve(tokens, 'primary')), name).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(styles.dangerButtonText.color, styles.dangerButton.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    });

    it('keeps ordinary, muted, placeholder and warning text readable on both app surfaces', () => {
      for (const foreground of [theme.text, theme.muted, theme.placeholder, theme.warning]) {
        for (const background of [theme.background, theme.card]) {
          expect(contrast(foreground, background), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  });
}

it('does not retain burgundy/sand branding or white-on-coral selected labels', () => {
  const source = readFileSync(path.join(process.cwd(), 'src/theme.ts'), 'utf8');
  expect(source).not.toMatch(/#(?:8a1538|a3264d|1d1b18|24211d|f4f0e8|fbf8f2)\b/i);
  for (const file of ['App.tsx', 'src/components.tsx']) {
    const component = readFileSync(path.join(process.cwd(), file), 'utf8');
    expect(component).not.toMatch(/\?\s*['"]#ffffff['"]\s*:\s*theme\.text/);
    expect(component).toContain('stylesForTheme(theme)');
  }
});

it('preserves the explicitly labelled urgency and status cue palettes', () => {
  const source = readFileSync(path.join(process.cwd(), 'src/components.tsx'), 'utf8');
  for (const cue of [
    "urgent: { label: 'urgent', color: '#fecaca', backgroundColor: '#7f1d1d' }",
    "soon: { label: 'soon', color: '#fde68a', backgroundColor: '#713f12' }",
    "routine: { label: 'routine', color: '#bfdbfe', backgroundColor: '#1e3a8a' }",
    "pending: { label: 'pending', color: '#e5e7eb', backgroundColor: '#374151' }",
    "seen: { label: 'seen', color: '#bbf7d0', backgroundColor: '#14532d' }",
    "waiting: { label: 'waiting', color: '#fed7aa', backgroundColor: '#7c2d12' }",
    "done: { label: 'done', color: '#d1d5db', backgroundColor: '#111827' }",
  ]) expect(source).toContain(cue);
});
