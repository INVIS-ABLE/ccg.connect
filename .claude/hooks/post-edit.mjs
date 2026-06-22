#!/usr/bin/env node
/**
 * PostToolUse hook (Write|Edit):
 *  1. Auto-format the edited file with eslint --fix (best effort, never blocks).
 *  2. Warn when permission-related files change (reminder to add permission tests).
 *  3. Warn when entity schema files change (reminder for RLS + migration note).
 *
 * Warnings are emitted on stderr with a non-zero exit so they surface to the
 * agent, but they are advisory — they never undo or block the change.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

let payload = {};
try {
  payload = JSON.parse(readStdin() || '{}');
} catch {
  process.exit(0);
}

const filePath = String(payload.tool_input?.file_path || '');
if (!filePath) process.exit(0);

// 1. Format JS/TS source (best effort).
if (/\.(jsx?|tsx?)$/.test(filePath)) {
  try {
    execSync(`npx --no-install eslint --fix "${filePath}"`, { stdio: 'ignore', timeout: 60000 });
  } catch {
    // formatting is best-effort; ignore failures
  }
}

const warnings = [];

// 2. Permission-related files.
if (/(roles|permission|ProtectedRoute|RootLayout|\/auth\/)/i.test(filePath) && !/\.(test|spec)\./.test(filePath)) {
  warnings.push(
    `Permission-related file changed (${filePath}). Ensure permission tests cover the new behaviour ` +
      `and that a matching server-side / RLS check exists — frontend hiding is not security.`,
  );
}

// 3. Entity schema changes.
if (/base44\/entities\/.*\.jsonc$/.test(filePath)) {
  warnings.push(
    `Entity schema changed (${filePath}). Pair it with Base44 RLS rules and add a migration / ` +
      `compatibility note to the PR description (stable field names are the integration contract).`,
  );
}

if (warnings.length > 0) {
  process.stderr.write('Advisory (non-blocking):\n- ' + warnings.join('\n- ') + '\n');
  process.exit(2);
}

process.exit(0);
