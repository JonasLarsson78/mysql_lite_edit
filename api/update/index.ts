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

  const {
    host,
    user,
    password,
    database,
    port,
    table,
    updates,
    where,
    primaryKey,
    row,
  } = body || {}

  if (
    !host ||
    !user ||
    !database ||
    !table ||
    !updates ||
    typeof updates !== 'object'
  ) {
    return res
      .status(400)
      .json({
        error: 'Missing required fields: host,user,database,table,updates',
      })
  }

  if (!validateIdent(table))
    return res.status(400).json({ error: 'Invalid table name' })
  for (const c of Object.keys(updates))
    if (!validateIdent(c))
      return res.status(400).json({ error: 'Invalid column name in updates' })

  let conn: any
  try {
    conn = await mysql.createConnection({
      host,
      user,
      password,
      database,
      port,
    })

    let whereClause = ''
    const whereParams: any[] = []

    if (where && typeof where === 'object' && Object.keys(where).length > 0) {
      const parts: string[] = []
      for (const k of Object.keys(where)) {
        if (!validateIdent(k))
          return res.status(400).json({ error: 'Invalid column name in where' })
        parts.push(`\`${k}\` = ?`)
        whereParams.push(where[k])
      }
      whereClause = parts.join(' AND ')
    } else {
      // Try to infer primary key columns for the table
      const [pkRows]: any = await conn.execute(
        `SELECT k.COLUMN_NAME FROM information_schema.TABLE_CONSTRAINTS t JOIN information_schema.KEY_COLUMN_USAGE k ON t.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND t.TABLE_SCHEMA = k.TABLE_SCHEMA WHERE t.CONSTRAINT_TYPE = 'PRIMARY KEY' AND t.TABLE_SCHEMA = ? AND t.TABLE_NAME = ? ORDER BY k.ORDINAL_POSITION`,
        [database, table]
      )
      const pkCols = (pkRows || []).map((r: any) => r.COLUMN_NAME)

      if (
        primaryKey &&
        typeof primaryKey === 'object' &&
        Object.keys(primaryKey).length > 0
      ) {
        const parts: string[] = []
        for (const k of Object.keys(primaryKey)) {
          if (!validateIdent(k))
            return res
              .status(400)
              .json({ error: 'Invalid column name in primaryKey' })
          parts.push(`\`${k}\` = ?`)
          whereParams.push(primaryKey[k])
        }
        whereClause = parts.join(' AND ')
      } else if (pkCols.length > 0 && row && typeof row === 'object') {
        const parts: string[] = []
        for (const col of pkCols) {
          if (!(col in row))
            return res
              .status(400)
              .json({ error: `Primary key column ${col} missing from row` })
          parts.push(`\`${col}\` = ?`)
          whereParams.push(row[col])
        }
        whereClause = parts.join(' AND ')
      } else {
        return res
          .status(400)
          .json({
            error:
              'No where/primaryKey provided and primary key could not be inferred',
          })
      }
    }

    if (!whereClause)
      return res.status(400).json({ error: 'Could not determine WHERE clause' })

    // Build SET clause
    const setParts: string[] = []
    const setParams: any[] = []
    for (const col of Object.keys(updates)) {
      setParts.push(`\`${col}\` = ?`)
      setParams.push(updates[col])
    }

    const sql = `UPDATE \`${table}\` SET ${setParts.join(', ')} WHERE ${whereClause} LIMIT 1`
    const params = [...setParams, ...whereParams]

    const [result]: any = await conn.execute(sql, params)

    const out = {
      affectedRows: result.affectedRows ?? result.affected_rows ?? 0,
      changedRows: result.changedRows ?? result.changed_rows ?? 0,
      warnings: result.warningCount ?? result.warning_count ?? 0,
    }

    return res.status(200).json({ ok: true, ...out })
  } catch (err: any) {
    console.error('api/update error:', err)
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
