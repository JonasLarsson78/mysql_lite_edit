import mysql from 'mysql2/promise'

async function readJson(req: any) {
  if (req.body && typeof req.body === 'object') return req.body
  let raw = ''
  for await (const chunk of req) raw += chunk
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch (err) {
    throw new Error('Invalid JSON body')
  }
}

function validateIdent(name: string) {
  return /^[A-Za-z0-9_]+$/.test(name)
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' })

  let body: any
  try {
    body = await readJson(req)
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Invalid JSON' })
  }

  const { host, user, password, database, port, tableName } = body || {}

  if (!host || !user || !database || !tableName)
    return res
      .status(400)
      .json({ error: 'Missing required fields: host,user,database,tableName' })

  if (!validateIdent(tableName))
    return res.status(400).json({ error: 'Invalid table name' })

  let conn: any
  try {
    conn = await mysql.createConnection({
      host,
      user,
      password,
      database,
      port,
    })
    const sql = `DROP TABLE IF EXISTS \`${tableName}\``
    const [result] = await conn.execute(sql)
    return res.status(200).json({ ok: true, result })
  } catch (err: any) {
    console.error('api/drop-table error:', err)
    return res.status(500).json({ error: err?.message || String(err) })
  } finally {
    if (conn)
      try {
        await conn.end()
      } catch (e) {
        /* ignore */
      }
  }
}
