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

  const { host, user, password, database, port, tableName, row } = body || {}

  if (
    !host ||
    !user ||
    !database ||
    !tableName ||
    !row ||
    typeof row !== 'object'
  )
    return res
      .status(400)
      .json({
        error: 'Missing required fields: host,user,database,tableName,row',
      })

  if (!validateIdent(tableName))
    return res.status(400).json({ error: 'Invalid table name' })

  const cols = Object.keys(row)
  if (cols.length === 0)
    return res
      .status(400)
      .json({ error: 'Row must contain at least one column' })
  for (const c of cols)
    if (!validateIdent(c))
      return res.status(400).json({ error: `Invalid column name: ${c}` })

  let conn: any
  try {
    conn = await mysql.createConnection({
      host,
      user,
      password,
      database,
      port,
    })
    const colList = cols.map((c) => `\`${c}\``).join(', ')
    const placeholders = cols.map(() => '?').join(', ')
    const params = cols.map((c) => row[c])
    const sql = `INSERT INTO \`${tableName}\` (${colList}) VALUES (${placeholders})`
    const [result] = await conn.execute(sql, params)
    return res.status(200).json({ ok: true, result })
  } catch (err: any) {
    console.error('api/insert-row error:', err)
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
