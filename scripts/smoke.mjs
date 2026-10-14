import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
const directory = await mkdtemp(join(tmpdir(), 'autoai-smoke-'));
const base = 'http://127.0.0.1:4197';
let child;
async function start() {
  child=spawn(process.execPath,['dist/services/api/src/server.js'],{env:{PATH:process.env.PATH,API_PORT:'4197',DATABASE_PATH:join(directory,'smoke.sqlite'),APP_ORIGIN:'http://localhost:3000'},stdio:['ignore','pipe','pipe']});
  let output=''; child.stderr.on('data',chunk=>output+=chunk);
  for(let i=0;i<100;i++) {
    if(child.exitCode!==null) throw new Error(`API startup failed: ${output}`);
    try { if((await fetch(`${base}/api/health`)).ok) return; } catch {}
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  throw new Error('API did not become ready');
}
async function stop() { if(child && child.exitCode===null) {const exited=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await exited;} }
try {
 await start();
 assert.deepEqual(await (await fetch(`${base}/api/catalogue`)).json(),{vehicles:[]});
 const register=await fetch(`${base}/api/auth/register`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Synthetic smoke user',email:'smoke@example.test',password:randomBytes(24).toString('hex')})});
 assert.equal(register.status,201);const cookie=register.headers.get('set-cookie').split(';')[0];
 const headers={'Content-Type':'application/json',cookie};
 const ticket=await fetch(`${base}/api/support`,{method:'POST',headers,body:JSON.stringify({subject:'Synthetic smoke check',message:'Test-only support request to verify durable storage.'})});
 assert.equal(ticket.status,201);
 assert.equal((await fetch(`${base}/api/payments/checkout`,{method:'POST',headers,body:'{}'})).status,503);
 assert.equal((await fetch(`${base}/api/garage`)).status,401);
 await stop();await start();
 const persisted=await (await fetch(`${base}/api/support`,{headers})).json();assert.equal(persisted.tickets.length,1);
 await fetch(`${base}/api/auth/logout`,{method:'POST',headers,body:'{}'});
 assert.equal((await fetch(`${base}/api/auth/me`,{headers})).status,401);
 console.log('HTTP smoke passed: registration, access control, durable restart, support persistence, disabled payments, logout.');
} finally { await stop();await rm(directory,{recursive:true,force:true}); }
