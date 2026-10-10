#!/usr/bin/env bash
set -euo pipefail

package="${1:?Pass an absolute tarball path or an npm package spec}"
consumer="$(mktemp -d)"
trap 'rm -rf "$consumer"' EXIT
cd "$consumer"
npm init --yes >/dev/null
npm install --ignore-scripts --no-audit --no-fund "$package"
node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeConfig, libConfig } from '@jong-kyung/vp-config';
import plugin from '@jong-kyung/vp-config/plugin';

const manifestPath = fileURLToPath(import.meta.resolve('@jong-kyung/vp-config/package.json'));
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
assert.equal(manifest.name, '@jong-kyung/vp-config');
assert(!manifest.peerDependencies['vite-plus'].startsWith('catalog:'));
for (const entry of ['.', './plugin']) {
  assert(existsSync(resolve(dirname(manifestPath), manifest.exports[entry].types)));
}
const lint = nodeConfig.lint.extends[0];
assert.equal(libConfig.lint, nodeConfig.lint);
assert.equal(plugin.meta.name, 'jong-kyung');
assert(existsSync(lint.jsPlugins[0].specifier));
for (const name of Object.keys(lint.rules).filter((name) => name.startsWith('jong-kyung/'))) {
  assert.equal(typeof plugin.rules[name.slice('jong-kyung/'.length)].create, 'function');
}
console.log(`Imported ${manifest.name}@${manifest.version}, presets, plugin and declaration entrypoints.`);
NODE
