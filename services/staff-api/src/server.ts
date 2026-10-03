import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { Pool } from 'pg';
import { z } from 'zod';
import { requireAuth, requireRoles, signUser } from './auth.js';

const app=express();
const port=Number(process.env.PORT||4002);
const pool=new Pool({connectionString:process.env.STAFF_DATABASE_URL,max:20,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:undefined});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:Number(process.env.MAX_UPLOAD_MB||20)*1024*1024}});
app.disable('x-powered-by');
app.use(cors({origin:process.env.STAFF_WEB_ORIGINS?.split(',').map(s=>s.trim())||true}));
app.use(express.json({limit:'2mb'}));
app.use(rateLimit({windowMs:60_000,limit:300}));

app.get('/health',async(_req,res)=>{const r=await pool.query('SELECT 1 AS ok');res.json({ok:r.rows[0].ok===1,service:'staff-api'});});

app.post('/api/auth/login',async(req,res)=>{
  const body=z.object({username:z.string().min(1).max(100),password:z.string().min(1).max(200)}).safeParse(req.body);
  if(!body.success)return res.status(400).json({message:'Username and password are required.'});
  const r=await pool.query(`SELECT u.id,u.username,u.full_name,u.password_hash,u.role,u.site_id,s.code site_code,s.name site_name FROM staff.users u LEFT JOIN staff.sites s ON s.id=u.site_id WHERE u.username=$1 AND u.active=true LIMIT 1`,[body.data.username.trim()]);
  if(!r.rowCount||!(await bcrypt.compare(body.data.password,r.rows[0].password_hash)))return res.status(401).json({message:'Invalid username or password.'});
  const row=r.rows[0];
  const user={id:row.id,username:row.username,fullName:row.full_name,role:row.role,siteId:row.site_id,siteCode:row.site_code,siteName:row.site_name};
  await pool.query(`INSERT INTO staff.audit_logs(user_id,site_id,action,entity_type,metadata) VALUES($1,$2,'LOGIN','auth',$3)`,[row.id,row.site_id,JSON.stringify({})]);
  res.json({token:signUser(user as any),user});
});

app.get('/api/auth/me',requireAuth,async(req,res)=>res.json({user:req.user}));

app.get('/api/sites',requireAuth,async(req,res)=>{
  if(req.user!.role!=='admin')return res.json({sites:[]});
  const r=await pool.query(`SELECT id,code,name,city,hostname,active FROM staff.sites ORDER BY name`);res.json({sites:r.rows});
});

function siteFilter(user:any, params:any[], where:string[]) {
  if(user.role!=='admin') { params.push(user.siteId); where.push(`p.site_id=$${params.length}`); }
}

app.get('/api/passports',requireAuth,async(req,res)=>{
  const q=String(req.query.q||'').trim(); const status=String(req.query.status||'');
  const limit=Math.min(Number(req.query.limit||50),200); const params:any[]=[]; const where:string[]=[];
  siteFilter(req.user,params,where);
  if(q){params.push(`%${q.replace(/[%_]/g,'')}%`);where.push(`(p.arn ILIKE $${params.length} OR p.full_name ILIKE $${params.length} OR COALESCE(p.passport_number,'') ILIKE $${params.length})`);}
  if(status==='Collected'||status==='Not Collected'){params.push(status);where.push(`p.collection_status=$${params.length}`);}
  params.push(limit);
  const r=await pool.query(`SELECT p.id,p.arn,p.full_name,p.passport_number,p.unique_code,p.arrival_date,p.collection_status,p.collected_at,s.code site_code,s.name site_name FROM staff.passports p JOIN staff.sites s ON s.id=p.site_id WHERE ${where.length?where.join(' AND '):'TRUE'} ORDER BY p.updated_at DESC LIMIT $${params.length}`,params);
  res.json({results:r.rows});
});

app.post('/api/passports/:id/collect',requireAuth,requireRoles('admin','manager','supervisor','officer'),async(req,res)=>{
  const id=req.params.id; const where=req.user!.role==='admin'?'p.id=$1':'p.id=$1 AND p.site_id=$2'; const params=req.user!.role==='admin'?[id]:[id,req.user!.siteId];
  const found=await pool.query(`SELECT p.id,p.site_id FROM staff.passports p WHERE ${where}`,params);
  if(!found.rowCount)return res.status(404).json({message:'Passport not found for your site.'});
  const siteId=found.rows[0].site_id;
  await pool.query(`UPDATE staff.passports SET collection_status='Collected',collected_by=$1,collected_at=NOW(),updated_at=NOW() WHERE id=$2`,[req.user!.id,id]);
  await pool.query(`INSERT INTO staff.audit_logs(user_id,site_id,action,entity_type,entity_id) VALUES($1,$2,'COLLECT','passport',$3)`,[req.user!.id,siteId,id]);
  res.json({ok:true});
});

app.post('/api/passports/import',requireAuth,requireRoles('admin','manager'),upload.single('file'),async(req,res)=>{
  if(!req.file)return res.status(400).json({message:'Excel file is required.'});
  if(req.user!.role!=='admin'&&!req.user!.siteId)return res.status(403).json({message:'Your account has no site.'});
  const workbook=XLSX.read(req.file.buffer,{type:'buffer',cellDates:true});
  const sheet=workbook.Sheets[workbook.SheetNames[0]]; const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(sheet,{defval:null,raw:true});
  const siteId=req.user!.role==='admin' ? String(req.body.siteId||'') : req.user!.siteId!;
  if(!siteId)return res.status(400).json({message:'siteId is required for admin imports.'});
  const site=await pool.query(`SELECT id FROM staff.sites WHERE id=$1 AND active=true`,[siteId]);if(!site.rowCount)return res.status(400).json({message:'Invalid site.'});
  const aliases=(row:any, names:string[])=>{for(const n of names){const key=Object.keys(row).find(k=>k.trim().toLowerCase()===n.toLowerCase());if(key&&row[key]!=null&&String(row[key]).trim())return String(row[key]).trim();}return null;};
  const toDate=(v:any)=>{if(v instanceof Date&&!isNaN(v.getTime()))return v.toISOString().slice(0,10);if(typeof v==='number'){const d=XLSX.SSF.parse_date_code(v);if(d)return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;}if(v){const d=new Date(String(v));if(!isNaN(d.getTime()))return d.toISOString().slice(0,10);}return null;};
  const arrivalImportDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Addis_Ababa',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const client=await pool.connect(); let imported=0; let skipped=0;
  try{await client.query('BEGIN');
    for(const row of rows){const arn=aliases(row,['ARN','Application Reference Number','Application Reference','Reference Number']);const fullName=aliases(row,['Full Name','Name','Applicant Name']);if(!arn||!fullName){skipped++;continue;}
      const passportNumber=aliases(row,['Passport Number','Passport No','Passport No.']);const uniqueCode=aliases(row,['Unique Code','Code']);const suppliedArrival=toDate(row[Object.keys(row).find(k=>/arrival/i.test(k))||'']);
      await client.query(`INSERT INTO staff.passports(site_id,arn,full_name,passport_number,unique_code,arrival_date,source_row,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,NOW()) ON CONFLICT(site_id,arn) DO UPDATE SET full_name=EXCLUDED.full_name,passport_number=COALESCE(EXCLUDED.passport_number,staff.passports.passport_number),unique_code=COALESCE(staff.passports.unique_code,EXCLUDED.unique_code),arrival_date=COALESCE(staff.passports.arrival_date,EXCLUDED.arrival_date),source_row=EXCLUDED.source_row,updated_at=NOW()`,[siteId,arn,fullName,passportNumber,uniqueCode,suppliedArrival||arrivalImportDate,JSON.stringify(row)]);
      imported++;
    }
    await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK');return res.status(500).json({message:'Import failed.'});}finally{client.release();}
  res.json({ok:true,imported,skipped,arrivalDateUsedForMissing:arrivalImportDate});
});

app.get('/api/reports/summary',requireAuth,async(req,res)=>{
  const params:any[]=[];let filter='';if(req.user!.role!=='admin'){params.push(req.user!.siteId);filter=`WHERE site_id=$1`;}
  const r=await pool.query(`SELECT COUNT(*)::int total, COUNT(*) FILTER(WHERE collection_status='Collected')::int collected, COUNT(*) FILTER(WHERE collection_status='Not Collected')::int not_collected FROM staff.passports ${filter}` ,params);
  res.json({summary:r.rows[0]});
});

app.use((_req,res)=>res.status(404).json({message:'Not found.'}));
app.listen(port,()=>console.log(`Staff API listening on ${port}`));
