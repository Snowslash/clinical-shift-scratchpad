/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();
const require = createRequire(path.join(projectRoot, 'package.json'));
const packageJson = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const installedExpo = JSON.parse(readFileSync(require.resolve('expo/package.json'), 'utf8'));
const appConfig = JSON.parse(readFileSync(path.join(projectRoot, 'app.json'), 'utf8'));

// Expo Go includes one SDK. Keep the project aligned with the supported phone client.
describe('Expo Go SDK 57 compatibility', () => {
  it('declares and installs Expo SDK 57', () => {
    expect(packageJson.dependencies.expo).toMatch(/^[~^]?57\./);
    expect(installedExpo.version).toMatch(/^57\./);
  });

  it('does not override the SDK with a stale app-config version', () => {
    expect(appConfig.expo.sdkVersion ?? '57.0.0').toBe('57.0.0');
  });
});
