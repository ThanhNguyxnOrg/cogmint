import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('./stage-release-assets.mjs', import.meta.url));
const contracts = {
  'windows-x64': ['COGMINT_2.0.0_x64-setup.exe', 'COGMINT_2.0.0_x64_en-US.msi'],
  'macos-arm64': ['COGMINT_2.0.0_aarch64.app.tar.gz', 'COGMINT_2.0.0_aarch64.dmg'],
  'macos-x64': ['COGMINT_2.0.0_x64.app.tar.gz', 'COGMINT_2.0.0_x64.dmg'],
  'linux-x64': ['COGMINT_2.0.0_amd64.AppImage', 'COGMINT_2.0.0_amd64.deb', 'COGMINT-2.0.0-1.x86_64.rpm'],
};

function fixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'cogmint-assets-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  return cwd;
}

function bundle(cwd, relative, names) {
  const root = path.join(cwd, 'src-tauri/target', relative, 'release/bundle/packages');
  fs.mkdirSync(root, { recursive: true });
  for (const name of names) fs.writeFileSync(path.join(root, name), name);
}

function run(cwd, env = {}) {
  return spawnSync(process.execPath, [script], {
    cwd,
    env: { ...process.env, VERSION: '2.0.0', VARIANT: 'windows-x64', ...env },
    encoding: 'utf8',
  });
}

for (const [variant, names] of Object.entries(contracts)) {
  for (const target of ['', 'a-target-triple']) {
    test(`${variant} stages exact assets from ${target || 'default'} target`, (t) => {
      const cwd = fixture(t);
      bundle(cwd, target, [...names, 'unrelated.txt']);
      const result = run(cwd, { VARIANT: variant });
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(fs.readdirSync(path.join(cwd, 'dist/release')).sort(), [...names].sort());
      for (const name of names) {
        assert.equal(fs.readFileSync(path.join(cwd, 'dist/release', name), 'utf8'), name);
      }
    });
  }
}

test('rejects missing inputs, unsupported variants and absent bundles', (t) => {
  const cwd = fixture(t);
  for (const [env, message] of [
    [{ VERSION: '' }, /VERSION and VARIANT are required/],
    [{ VARIANT: '' }, /VERSION and VARIANT are required/],
    [{ VARIANT: 'unknown' }, /Unsupported COGMINT release target/],
    [{}, /Tauri bundle directories not found/],
  ]) {
    const result = run(cwd, env);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, message);
  }
});

for (const variant of ['macos-arm64', 'macos-x64']) {
  test(`${variant} versions the native Tauri app archive`, (t) => {
    const cwd = fixture(t);
    const names = contracts[variant];
    bundle(cwd, 'apple-darwin', ['COGMINT.app.tar.gz', names[1]]);
    const result = run(cwd, { VARIANT: variant });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(fs.readdirSync(path.join(cwd, 'dist/release')).sort(), [...names].sort());
  });
}

test('rejects empty, incomplete, duplicate and stale asset sets', (t) => {
  const cwd = fixture(t);
  const names = contracts['windows-x64'];
  bundle(cwd, '', []);
  assert.match(run(cwd).stderr, /found 0/);
  bundle(cwd, '', [names[0]]);
  assert.match(run(cwd).stderr, /found 0/);
  bundle(cwd, '', names);
  bundle(cwd, 'duplicate-target', [names[0]]);
  assert.match(run(cwd).stderr, /found 2/);
  fs.rmSync(path.join(cwd, 'src-tauri/target/duplicate-target'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'dist/release/stale.txt'), 'stale');
  assert.match(run(cwd).stderr, /Staged release set does not match/);
});
