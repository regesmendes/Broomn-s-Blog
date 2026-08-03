module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  // Jest's own default order (js before ts) means a stale `tsc` build output
  // sitting next to its .ts source (e.g. from a local `npm run build`) would
  // otherwise silently shadow every edit to that source in every test run —
  // this bit us for real: a stale lib/stacks/api-stack.js caused a synth
  // test to miss a real IAM policy gap because it wasn't testing the current
  // source at all. cdk.json's `app` entry already avoids this via ts-node's
  // `--prefer-ts-exts`; this is the equivalent guarantee for `npm test`.
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  setupFilesAfterEnv: ['aws-cdk-lib/testhelpers/jest-autoclean'],
};
