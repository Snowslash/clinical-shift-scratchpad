/// <reference types="node" />

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();
const appSource = readFileSync(path.join(projectRoot, 'App.tsx'), 'utf8');
const componentsSource = readFileSync(path.join(projectRoot, 'src/components.tsx'), 'utf8');
const jobTypesSource = readFileSync(path.join(projectRoot, 'src/types/job.ts'), 'utf8');
const packageJson = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>;
};

describe('React Native quality boundaries', () => {
  it('uses the Expo 54 safe-area context provider instead of deprecated React Native SafeAreaView', () => {
    const reactNativeImport = appSource.match(/import\s+\{([^}]*)\}\s+from 'react-native';/)?.[1] ?? '';

    expect(packageJson.dependencies?.['react-native-safe-area-context']).toBe('~5.6.0');
    expect(appSource).toContain("import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';");
    expect(reactNativeImport).not.toContain('SafeAreaView');
    const providerOpen = appSource.indexOf('<SafeAreaProvider>');
    const consumerOpen = appSource.indexOf('<SafeAreaView');
    const consumerClose = appSource.indexOf('</SafeAreaView>');
    const providerClose = appSource.indexOf('</SafeAreaProvider>');
    expect(providerOpen).toBeGreaterThan(-1);
    expect(providerOpen).toBeLessThan(consumerOpen);
    expect(consumerOpen).toBeLessThan(consumerClose);
    expect(consumerClose).toBeLessThan(providerClose);
  });

  it('keeps shortcut parsing at module scope', () => {
    const parserDeclaration = appSource.indexOf('const parseShortcutText =');
    const appDeclaration = appSource.indexOf('export default function App');

    expect(parserDeclaration).toBeGreaterThan(-1);
    expect(parserDeclaration).toBeLessThan(appDeclaration);
  });

  it('uses lazy state initializers for joined shortcut settings', () => {
    expect(componentsSource).toContain("useState(() => settings.locationShortcuts.join(', '))");
    expect(componentsSource).toContain("useState(() => settings.noteShortcuts.join(', '))");
    expect(componentsSource).toContain("useState(() => settings.statusPhraseShortcuts.join(', '))");
  });


  it('removes the unused urgency export and keeps status controls legible', () => {
    expect(jobTypesSource).not.toContain('export const URGENCIES');
    expect(componentsSource).toContain("<Text style={{ color: job.status === status ? statusStyle[status].color : theme.text, fontSize: 12, fontWeight: '800' }}>{status}</Text>");
  });
});
