import { buildApp } from './app.js';
const app=buildApp();
await app.listen({host:'127.0.0.1',port:Number(process.env.API_PORT??4000)});
console.log('AutoAI API listening on http://127.0.0.1:4000');
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>{void app.close().then(()=>process.exit(0));});
