import { randomUUID } from 'node:crypto';
import { openDatabase } from './db.js';
import { hashPassword } from './auth.js';
import { z } from 'zod';
// Supply credentials through process environment; never pass the password in shell arguments.
const data=z.object({ADMIN_EMAIL:z.string().email().transform(v=>v.toLowerCase()),ADMIN_NAME:z.string().min(1).max(160),ADMIN_PASSWORD:z.string().min(16).max(128)}).parse(process.env);
const db=openDatabase(process.env.DATABASE_PATH??'/workspace/autoai-india-greenfield/.data/autoai.sqlite');
try { db.prepare("INSERT INTO users(id,email,name,password_hash,role) VALUES (?,?,?,?,'admin')").run(randomUUID(),data.ADMIN_EMAIL,data.ADMIN_NAME,hashPassword(data.ADMIN_PASSWORD)); console.log('Administrator created.'); } finally {db.close();}
