import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';

const pool=new Pool({connectionString:process.env.STAFF_DATABASE_URL,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:undefined});
const username=process.env.ADMIN_USERNAME||'admin';
const password=process.env.ADMIN_PASSWORD||'ChangeMe123!';
const fullName=process.env.ADMIN_FULL_NAME||'System Administrator';
const hash=await bcrypt.hash(password,12);
await pool.query(`INSERT INTO staff.users(username,full_name,password_hash,role,site_id) VALUES($1,$2,$3,'admin',NULL) ON CONFLICT(username) DO UPDATE SET full_name=EXCLUDED.full_name,password_hash=EXCLUDED.password_hash,role='admin',site_id=NULL,active=true`,[username,fullName,hash]);
console.log(`Admin ${username} created/updated.`);
await pool.end();
