// Kills whatever is listening on the server's port, for when a stray `npm start` holds it.
// It kills the process tree, so a headless page's browser goes with its server (an orphaned page reconnects to the
// next server on the port and renders every job with stale code).
// usage: node scripts/stop.mjs [port]   (default: PORT env, else 3000)
import { execFileSync } from 'node:child_process';

const port = process.argv[2] || process.env.PORT || 3000;
const win = process.platform === 'win32';
const run = (cmd, args) => { try { return execFileSync(cmd, args, { encoding: 'utf8' }); } catch { return ''; } };

// netstat/lsof rather than a /quit route: this has to work on a server that is wedged, not just idle
const pids = [...new Set(win
  ? run('netstat', ['-ano', '-p', 'tcp']).split('\n')
      .filter((l) => l.includes('LISTENING') && new RegExp(`[:.]${port}\\s`).test(l))
      .map((l) => l.trim().split(/\s+/).pop())
  : run('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN']).split('\n'))]
  .map(Number).filter((p) => p > 0 && p !== process.pid);

if (!pids.length) { console.log(`nothing listening on ${port}`); process.exit(0); }
for (const pid of pids) {
  try {
    if (win) {
      // taskkill /T takes the browser child along; process.kill would leave it orphaned
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
      console.log(`killed ${pid} and its children on ${port}`);
    } else { process.kill(pid, 'SIGKILL'); console.log(`killed ${pid} on ${port}`); }
  } catch (e) { console.error(`could not kill ${pid}: ${e.message}`); process.exitCode = 1; }
}

if (win) {
  const n = ['chrome-headless-shell.exe', 'headless_shell.exe']
    .reduce((t, im) => t + run('tasklist', ['/FI', `IMAGENAME eq ${im}`, '/FO', 'CSV', '/NH']).split('\n').filter((l) => l.trim().startsWith('"' + im)).length, 0);
  if (n) console.log(`warning: ${n} stale headless browsers still alive (started by another run): taskkill /IM chrome-headless-shell.exe /F to clear them`);
}
