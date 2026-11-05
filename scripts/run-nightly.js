// Nightly test run — "it becomes a test, re-run every night".
// Runs the full test suite (including every flag-derived regression
// test in tests/flag-regressions.test.js, which reads
// tests/flag-cases.json) and writes a report to
// tests/nightly-report.json: { ranAt, pass, fail, flagCases, cases }.
// Run: npm run test:nightly
// NOTE: this script is the nightly RUNNER. No nightly cron / scheduled
// job is created by this repo — schedule it (e.g. a Vercel Cron, a
// GitHub Action, or a local cron) separately, and do not claim a
// nightly run happens until one is actually scheduled.
'use strict';
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const flagCases = JSON.parse(fs.readFileSync(path.join(root, 'tests', 'flag-cases.json'), 'utf8'));
const started = Date.now();
let pass = 0, fail = 0, output = '';
try {
  output = execFileSync('node', ['--test', 'tests/flag-regressions.test.js', 'tests/agents.test.js', 'tests/api.test.js', 'tests/flags.test.js', 'tests/rules.test.js', 'tests/skills.test.js', 'tests/think.test.js', 'tests/feedback.test.js'], { cwd: root, encoding: 'utf8' });
  const m = output.match(/ℹ pass (\d+)/);
  pass = m ? Number(m[1]) : 0;
  const f = output.match(/ℹ fail (\d+)/);
  fail = f ? Number(f[1]) : 0;
} catch (e) {
  output = (e.stdout || '') + (e.stderr || '') + String(e.message);
  const m = output.match(/ℹ pass (\d+)/);
  pass = m ? Number(m[1]) : 0;
  const f = output.match(/ℹ fail (\d+)/);
  fail = f ? Number(f[1]) : 1;
}
const report = {
  ranAt: new Date().toISOString(),
  durationMs: Date.now() - started,
  pass,
  fail,
  flagCases: flagCases.length,
  flagCaseIds: flagCases.map((c) => c.id),
  ok: fail === 0,
  note: 'Nightly re-run of the full suite, including every flag-derived regression test. No cron is scheduled by this repo yet — see scripts/run-nightly.js.',
};
fs.writeFileSync(path.join(root, 'tests', 'nightly-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
