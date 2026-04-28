#!/usr/bin/env node
/**
 * `npm run dev:lan` — Next dev listening on 0.0.0.0 so phones on the same LAN can reach the app.
 * Respects PORT (default 3000). See printed URLs for Extension `apiBaseUrl` (use LAN IP, not localhost).
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import os from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nextBin = join(root, 'node_modules/next/dist/bin/next');

const rawPort = process.env.PORT;
const port = Number(rawPort !== undefined && rawPort !== '' ? rawPort : 3000);

function collectLanIpv4Addresses() {
  /** @type {string[]} */
  const out = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.internal) continue;
      const fam = net.family;
      const isV4 = fam === 'IPv4' || fam === 4 || String(fam) === '4';
      if (isV4 && net.address) {
        out.push(net.address);
      }
    }
  }
  return [...new Set(out)].sort();
}

const addrs = collectLanIpv4Addresses();

console.log('');
console.log('[dev:lan] Listening on 0.0.0.0:' + port + ' — open on your phone (same Wi‑Fi):');
if (addrs.length === 0) {
  console.log('  (no non-loopback IPv4 — check Wi‑Fi / VPN / firewall)');
} else {
  for (const a of addrs) {
    console.log('  http://' + a + ':' + port);
  }
}
console.log('');
console.log('[dev:lan] Extension: set apiBaseUrl to http://<IP>:' + port + ' , not localhost.');
console.log('[dev:lan] Allow incoming TCP ' + port + ' in the OS firewall if the phone cannot connect.');
console.log('');

const isWin = process.platform === 'win32';

/** @type {import('child_process').ChildProcess | undefined} */
let child;

function forwardSignal(sig) {
  if (child && !child.killed) {
    try {
      child.kill(sig);
    } catch {
      /* ignore */
    }
  }
}

process.on('SIGINT', () => {
  forwardSignal('SIGINT');
  process.exit(130);
});
process.on('SIGTERM', () => forwardSignal('SIGTERM'));

child = spawn(
  'npx',
  ['-y', 'node@20', nextBin, 'dev', '--hostname', '0.0.0.0', '--port', String(port)],
  {
    cwd: root,
    stdio: 'inherit',
    shell: isWin,
    env: { ...process.env, PORT: String(port) },
  },
);

child.on('error', (err) => {
  console.error(err);
  process.exit(1);
});

child.on('exit', (code, sig) => {
  if (sig === 'SIGINT') {
    process.exit(130);
  }
  process.exit(code ?? 1);
});
