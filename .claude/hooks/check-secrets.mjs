#!/usr/bin/env node
/**
 * PreToolUse hook (Write|Edit): block writing obvious secrets into the repo.
 * Exit 2 + stderr blocks the tool call; exit 0 allows it.
 * Intentionally high-confidence patterns to keep false positives low.
 */
import { readFileSync } from 'node:fs';

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
  process.exit(0); // can't parse — don't block
}

const input = payload.tool_input || {};
const filePath = String(input.file_path || '');

// Skip files where secret-like strings are expected/legitimate.
if (
  /(\.test\.|\.spec\.|\.example|\.sample)/.test(filePath) ||
  filePath.includes('.claude/hooks/') ||
  filePath.endsWith('package-lock.json')
) {
  process.exit(0);
}

const text = String(input.content ?? input.new_string ?? '');
if (!text) process.exit(0);

const PATTERNS = [
  { name: 'Private key block', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
  { name: 'AWS access key id', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z_\-]{35}\b/ },
  { name: 'Slack token', re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
  { name: 'Stripe secret key', re: /\bsk_(?:live|test)_[0-9A-Za-z]{16,}\b/ },
  {
    name: 'Hardcoded credential assignment',
    re: /(secret|password|passwd|api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*['"][^'"\s]{16,}['"]/i,
  },
];

const hits = PATTERNS.filter((p) => p.re.test(text)).map((p) => p.name);

if (hits.length > 0) {
  process.stderr.write(
    `Blocked: possible secret(s) in ${filePath || 'file'} — ${hits.join(', ')}.\n` +
      `Secrets must never be committed. Use environment variables / Base44 secrets instead.\n` +
      `If this is a false positive, name the file *.example or move the value out of source.\n`,
  );
  process.exit(2);
}

process.exit(0);
