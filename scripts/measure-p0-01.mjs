#!/usr/bin/env node
/** Local P0-01 baseline. Emits metadata and build timing only; never logs query values. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import process from 'node:process';

const args = new Set(process.argv.slice(2));
const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url)),
);
const result = {
  schema: 'p0-01-local-baseline/v1',
  capturedAt: new Date().toISOString(),
  node: process.version,
  platform: `${process.platform}/${process.arch}`,
  package: { name: packageJson.name, version: packageJson.version },
  command: args.has('--build') ? 'pnpm build' : 'metadata-only',
};

if (args.has('--build')) {
  const started = performance.now();
  try {
    execFileSync('pnpm', ['build'], {
      stdio: 'ignore',
      env: { ...process.env, CI: '1' },
    });
    result.build = {
      status: 'passed',
      durationMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    result.build = {
      status: 'failed',
      durationMs: Math.round(performance.now() - started),
      exitCode: error.status ?? null,
    };
    process.exitCode = 1;
  }
}

const fingerprint = createHash('sha256')
  .update(JSON.stringify(result))
  .digest('hex')
  .slice(0, 12);
console.log(
  JSON.stringify({ ...result, evidenceId: `p0-01-${fingerprint}` }, null, 2),
);
