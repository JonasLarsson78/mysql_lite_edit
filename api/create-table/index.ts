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

function validateType(t: string) {
  if (!t || typeof t !== 'string') return false
  const s = t.trim().toUpperCase()
  // allow common MySQL types with optional length/precision
  // allow common MySQL types with optional length/precision
  const common =
    /^(INT|TINYINT|SMALLINT|MEDIUMINT|BIGINT)(\(\d+\))?$/.test(s) ||
    /^(VARCHAR|CHAR)\(\d+\)$/.test(s) ||
    /^(TEXT|MEDIUMTEXT|LONGTEXT)$/.test(s) ||
    /^(DATE|DATETIME|TIMESTAMP)$/.test(s) ||
    /^(FLOAT|DOUBLE)(\(\d+,\d+\))?$/.test(s) ||
    /^(DECIMAL)\(\d+,\d+\)$/.test(s) ||
    /^(BOOLEAN|BOOL)$/.test(s)

  // allow safe custom pattern like NAME or NAME(n) or NAME(n,m)
  const safePattern = /^[A-Z_][A-Z0-9_]*(\(\d+(,\d+)?\))?$/.test(s)

  return common || safePattern
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

  const { host, user, password, database, port, tableName, columns } =
    body || {}

  if (
    !host ||
    !user ||
    !database ||
    !tableName ||
    !Array.isArray(columns) ||
    columns.length === 0
  )
    return res
      .status(400)
      .json({
        error: 'Missing required fields: host,user,database,tableName,columns',
      })

  if (!validateIdent(tableName))
    return res.status(400).json({ error: 'Invalid table name' })

  for (const c of columns) {
    if (!c || !c.name || !c.type)
      return res
        .status(400)
        .json({ error: 'Each column must have name and type' })
    if (!validateIdent(c.name))
      return res.status(400).json({ error: `Invalid column name: ${c.name}` })
    if (!validateType(String(c.type)))
      return res
        .status(400)
        .json({ error: `Invalid or unsupported column type: ${c.type}` })
  }

  let conn: any
  try {
    conn = await mysql.createConnection({
      host,
      user,
      password,
      database,
      port,
    })

    const parts: string[] = []
    const pkCols: string[] = []
    for (const c of columns) {
      const pieces: string[] = []
      pieces.push(`\`${c.name}\``)
      pieces.push(String(c.type).toUpperCase())
      if (c.autoIncrement) pieces.push('AUTO_INCREMENT')
      if (c.nullable === false || c.notNull) pieces.push('NOT NULL')
      if (c.default !== undefined)
        pieces.push(`DEFAULT ${conn.escape(c.default)}`)
      parts.push(pieces.join(' '))
      if (c.primary) pkCols.push(c.name)
    }

    let sql = `CREATE TABLE IF NOT EXISTS \`${tableName}\` (${parts.join(', ')}`
    if (pkCols.length > 0)
      sql += `, PRIMARY KEY (${pkCols.map((n) => `\`${n}\``).join(', ')})`
    sql += ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'

    const [result] = await conn.execute(sql)

    return res.status(200).json({ ok: true, result })
  } catch (err: any) {
    console.error('api/create-table error:', err)
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
