#!/usr/bin/env node
/**
 * Fetches the Prisma schema engine binary for rhel-openssl-3.0.x (Lambda's
 * Amazon Linux 2023 runtime) directly into node_modules/@prisma/engines —
 * the migrate Lambda's CDK bundling hook (infrastructure/lib/stacks/api-stack.ts)
 * copies it from there.
 *
 * `npm rebuild @prisma/engines` (the previously documented approach) turned
 * out to be unreliable on a fresh checkout: @prisma/client, @prisma/engines,
 * and prisma's own lifecycle scripts all independently trigger the same
 * fetch-engine download logic, which is guarded by a 20-second lock file to
 * avoid duplicate downloads — whichever one wins the lock determines what
 * actually gets fetched, so a manual rebuild run shortly after `npm ci` can
 * silently no-op. Calling @prisma/fetch-engine's download() directly, once,
 * after everything else has settled, is deterministic.
 */
const { download } = require('@prisma/fetch-engine');
const { enginesVersion } = require('@prisma/engines-version');
const path = require('path');

const baseDir = path.join(__dirname, '..', '..', 'node_modules', '@prisma', 'engines');

download({
  binaries: { 'schema-engine': baseDir, 'libquery-engine': baseDir },
  version: enginesVersion,
  showProgress: true,
  failSilent: false,
  binaryTargets: ['rhel-openssl-3.0.x'],
})
  .then(() => {
    console.log('Fetched rhel-openssl-3.0.x Prisma engines to', baseDir);
  })
  .catch((err) => {
    console.error('Failed to fetch rhel-openssl-3.0.x Prisma engines:', err);
    process.exit(1);
  });
