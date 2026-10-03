import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Pool } from 'pg';
import { z } from 'zod';

const app = express();
const port = Number(process.env.PORT || 4001);
const pool = new Pool({ connectionString: process.env.PUBLIC_DATABASE_URL, max: 10, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined });

app.disable('x-powered-by');
app.use(cors({ origin: process.env.PUBLIC_WEB_ORIGIN?.split(',').map(s => s.trim()) || true }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }));

app.get('/health', async (_req, res) => {
  const r = await pool.query('SELECT 1 AS ok');
  res.json({ ok: r.rows[0].ok === 1, service: 'public-api' });
});

const searchSchema = z.object({
  q: z.string().trim().min(2).max(120),
  type: z.enum(['auto','arn','name','passport']).default('auto')
});

app.get('/api/public/search', async (req, res) => {
  const parsed = searchSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: 'Search text must be at least 2 characters.' });
  const { q, type } = parsed.data;
  const normalized = q.replace(/[%_]/g, '');
  let sql = `SELECT arn, full_name, passport_number, branch_code, branch_name, arrival_date, public_status, collected_at FROM public_passport.passports WHERE `;
  const params: string[] = [];
  if (type === 'arn') { sql += 'arn ILIKE $1'; params.push(`%${normalized}%`); }
  else if (type === 'passport') { sql += 'passport_number ILIKE $1'; params.push(`%${normalized}%`); }
  else if (type === 'name') { sql += 'full_name ILIKE $1'; params.push(`%${normalized}%`); }
  else { sql += '(arn ILIKE $1 OR full_name ILIKE $1 OR passport_number ILIKE $1)'; params.push(`%${normalized}%`); }
  sql += ' ORDER BY full_name ASC LIMIT 25';
  const result = await pool.query(sql, params);
  res.json({ results: result.rows.map(r => ({
    arn: r.arn, fullName: r.full_name, passportNumber: r.passport_number,
    branchCode: r.branch_code, branchName: r.branch_name,
    arrivalDate: r.arrival_date, publicStatus: r.public_status, collectedAt: r.collected_at
  })) });
});

app.get('/api/public/passport/:arn', async (req, res) => {
  const arn = String(req.params.arn || '').trim();
  if (!arn || arn.length > 80) return res.status(400).json({ message: 'Invalid ARN.' });
  const result = await pool.query(`SELECT arn, full_name, passport_number, branch_code, branch_name, arrival_date, public_status, collected_at FROM public_passport.passports WHERE arn=$1 LIMIT 1`, [arn]);
  if (!result.rowCount) return res.status(404).json({ message: 'Passport not found.' });
  const r = result.rows[0];
  res.json({ passport: { arn:r.arn, fullName:r.full_name, passportNumber:r.passport_number, branchCode:r.branch_code, branchName:r.branch_name, arrivalDate:r.arrival_date, publicStatus:r.public_status, collectedAt:r.collected_at } });
});

app.post('/api/internal/sync-upsert', async (req, res) => {
  if (!process.env.SYNC_SECRET || req.header('x-sync-secret') !== process.env.SYNC_SECRET) return res.status(401).json({ message: 'Unauthorized.' });
  const body = z.object({ records: z.array(z.object({
    arn:z.string().min(1).max(80), fullName:z.string().min(1).max(250), passportNumber:z.string().max(100).nullable().optional(),
    branchCode:z.string().max(50).nullable().optional(), branchName:z.string().max(150).nullable().optional(), arrivalDate:z.string().nullable().optional(),
    publicStatus:z.enum(['Collected','Not Collected']), collectedAt:z.string().nullable().optional()
  })).max(5000) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Invalid sync payload.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of body.data.records) {
      await client.query(`INSERT INTO public_passport.passports (arn,full_name,passport_number,branch_code,branch_name,arrival_date,public_status,collected_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
        ON CONFLICT (arn) DO UPDATE SET full_name=EXCLUDED.full_name, passport_number=EXCLUDED.passport_number, branch_code=EXCLUDED.branch_code, branch_name=EXCLUDED.branch_name, arrival_date=EXCLUDED.arrival_date, public_status=EXCLUDED.public_status, collected_at=EXCLUDED.collected_at, updated_at=NOW()`,
        [r.arn,r.fullName,r.passportNumber||null,r.branchCode||null,r.branchName||null,r.arrivalDate||null,r.publicStatus,r.collectedAt||null]);
    }
    await client.query('COMMIT');
    res.json({ ok:true, upserted:body.data.records.length });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ message:'Sync failed.' }); }
  finally { client.release(); }
});

app.use((_req,res) => res.status(404).json({message:'Not found.'}));
app.listen(port, () => console.log(`Public API listening on ${port}`));
