import { spawn } from 'node:child_process';

const children = [
  spawn('npm', ['run', 'dev:api'], { stdio: 'inherit' }),
  spawn('npm', ['run', 'dev:web'], { stdio: 'inherit' }),
];

function stop(signal: NodeJS.Signals = 'SIGTERM') {
  for (const child of children) if (!child.killed) child.kill(signal);
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => stop(signal));
for (const child of children) child.on('exit', code => { if (code && code !== 0) process.exitCode = code; });
