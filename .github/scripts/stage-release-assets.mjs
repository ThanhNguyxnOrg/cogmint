#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const version = process.env.VERSION;
const variant = process.env.VARIANT;
if (!version || !variant) {
  throw new Error('VERSION and VARIANT are required.');
}

const expectedByVariant = {
  'windows-x64': [
    `COGMINT_${version}_x64-setup.exe`,
    `COGMINT_${version}_x64_en-US.msi`,
  ],
  'macos-arm64': [
    `COGMINT_${version}_aarch64.app.tar.gz`,
    `COGMINT_${version}_aarch64.dmg`,
  ],
  'macos-x64': [
    `COGMINT_${version}_x64.app.tar.gz`,
    `COGMINT_${version}_x64.dmg`,
  ],
  'linux-x64': [
    `COGMINT_${version}_amd64.AppImage`,
    `COGMINT_${version}_amd64.deb`,
    `COGMINT-${version}-1.x86_64.rpm`,
  ],
};

const expected = expectedByVariant[variant];
if (!expected) {
  throw new Error(`Unsupported COGMINT release target: ${variant}`);
}

const target = path.resolve('src-tauri/target');
const roots = [path.join(target, 'release/bundle')];
if (fs.existsSync(target)) {
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== 'release') {
      roots.push(path.join(target, entry.name, 'release/bundle'));
    }
  }
}
const bundles = roots.filter((root) => fs.existsSync(root));
if (bundles.length === 0) {
  throw new Error(`Tauri bundle directories not found under: ${target}`);
}

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(fullPath);
    return entry.isFile() ? [fullPath] : [];
  });
}

const destination = path.resolve('dist/release');
fs.mkdirSync(destination, { recursive: true });
const candidates = bundles.flatMap(listFiles);
for (const name of expected) {
  const sourceNames = name.endsWith('.app.tar.gz') ? [name, 'COGMINT.app.tar.gz'] : [name];
  const matches = candidates.filter((candidate) => sourceNames.includes(path.basename(candidate)));
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one ${name} in Tauri bundles, found ${matches.length}`);
  }
  fs.copyFileSync(matches[0], path.join(destination, name));
  console.log(`Staged ${variant}: ${name}`);
}

const staged = fs.readdirSync(destination).sort();
if (staged.length !== expected.length || expected.some((name) => !staged.includes(name))) {
  throw new Error(`Staged release set does not match the ${variant} contract: ${staged.join(', ')}`);
}
console.log(`Validated ${staged.length} ${variant} release assets.`);
