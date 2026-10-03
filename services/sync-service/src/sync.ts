import 'dotenv/config';
import {Pool} from 'pg';
const staff=new Pool({connectionString:process.env.STAFF_DATABASE_URL,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:undefined});
const pub=new Pool({connectionString:process.env.PUBLIC_DATABASE_URL,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:undefined});
const batchSize=Math.min(Number(process.env.BATCH_SIZE||1000),5000);
const run=await pub.query(`INSERT INTO public_passport.sync_runs(status) VALUES('running') RETURNING id`);const runId=run.rows[0].id;
try{
 let offset=0,seen=0,upserted=0;
 while(true){const r=await staff.query(`SELECT p.arn,p.full_name,p.passport_number,s.code branch_code,s.name branch_name,p.arrival_date,p.collection_status,p.collected_at FROM staff.passports p JOIN staff.sites s ON s.id=p.site_id WHERE s.active=true ORDER BY p.id OFFSET $1 LIMIT $2`,[offset,batchSize]);if(!r.rows.length)break;
   const client=await pub.connect();try{await client.query('BEGIN');for(const x of r.rows){await client.query(`INSERT INTO public_passport.passports(arn,full_name,passport_number,branch_code,branch_name,arrival_date,public_status,collected_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW()) ON CONFLICT(arn) DO UPDATE SET full_name=EXCLUDED.full_name,passport_number=EXCLUDED.passport_number,branch_code=EXCLUDED.branch_code,branch_name=EXCLUDED.branch_name,arrival_date=EXCLUDED.arrival_date,public_status=EXCLUDED.public_status,collected_at=EXCLUDED.collected_at,updated_at=NOW()`,[x.arn,x.full_name,x.passport_number,x.branch_code,x.branch_name,x.arrival_date,x.collection_status,x.collected_at]);upserted++;}await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
   seen+=r.rows.length;offset+=r.rows.length;if(r.rows.length<batchSize)break;
 }
 await pub.query(`UPDATE public_passport.sync_runs SET finished_at=NOW(),rows_seen=$1,rows_upserted=$2,status='success' WHERE id=$3`,[seen,upserted,runId]);console.log({seen,upserted});
}catch(e){await pub.query(`UPDATE public_passport.sync_runs SET finished_at=NOW(),status='failed',error_message=$1 WHERE id=$2`,[e instanceof Error?e.message:'Unknown error',runId]);console.error(e);process.exitCode=1}
finally{await staff.end();await pub.end()}
