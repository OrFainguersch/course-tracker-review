import { cp, mkdir, rm, copyFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'native-www');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await copyFile(resolve(root, 'index.html'), resolve(out, 'index.html'));
await copyFile(resolve(root, 'manifest.webmanifest'), resolve(out, 'manifest.webmanifest'));
await cp(resolve(root, 'assets'), resolve(out, 'assets'), { recursive: true });
await writeFile(resolve(out, '.flympus-native-build.json'), JSON.stringify({ source: 'GitHub main', generatedAt: new Date().toISOString() }, null, 2) + '\n');
console.log('Prepared native-www from the current FLYMPUS web source.');
