// Kills whatever is listening on the server's port, for when a stray `npm start` holds it.
// usage: node scripts/stop.mjs [port]   (default: PORT env, else 3000)
import { execFileSync } from 'node:child_process';

const port = process.argv[2] || process.env.PORT || 3000;
const run = (cmd, args) => { try { return execFileSync(cmd, args, { encoding: 'utf8' }); } catch { return ''; } };

// netstat/lsof rather than a /quit route: this has to work on a server that is wedged, not just idle
const pids = [...new Set(process.platform === 'win32'
  ? run('netstat', ['-ano', '-p', 'tcp']).split('\n')
      .filter((l) => l.includes('LISTENING') && new RegExp(`[:.]${port}\\s`).test(l))
      .map((l) => l.trim().split(/\s+/).pop())
  : run('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN']).split('\n'))]
  .map(Number).filter((p) => p > 0 && p !== process.pid);

if (!pids.length) { console.log(`nothing listening on ${port}`); process.exit(0); }
for (const pid of pids) {
  try { process.kill(pid, 'SIGKILL'); console.log(`killed ${pid} on ${port}`); }
  catch (e) { console.error(`could not kill ${pid}: ${e.message}`); process.exitCode = 1; }
}
