import mysql from 'mysql2/promise'
import path from 'path'
import dotenv from 'dotenv'
import type {
  IncomingMessage as VercelRequest,
  ServerResponse as VercelResponse,
} from 'http'
import { log } from 'console'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

async function readJsonBody(req: VercelRequest) {
  let body: any = {}
  let rawData = ''
  let parseError: any = null
  try {
    const maybeBody = (req as any).body
    if (maybeBody && Object.keys(maybeBody).length !== 0) {
      body = maybeBody
      log('Using pre-parsed req.body from middleware:', body)
      return { body, rawData, parseError }
    }
    for await (const chunk of req) rawData += chunk
    try {
      body = JSON.parse(rawData || '{}')
    } catch (e) {
      parseError = e
      body = {}
    }
  } catch (e) {
    log('Accessing req.body threw, will attempt to stream raw body:', e)
    parseError = e
    try {
      for await (const chunk of req) rawData += chunk
      try {
        body = JSON.parse(rawData || '{}')
      } catch (e2) {
        parseError = parseError || e2
        body = {}
      }
    } catch (streamErr) {
      log('Error reading raw request stream after req.body threw:', streamErr)
    }
  }
  return { body, rawData, parseError }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { body, rawData, parseError } = await readJsonBody(req)
  const contentType = req.headers['content-type'] || ''

  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    res.statusCode = 405
    return res.end(JSON.stringify({ message: 'Method Not Allowed' }))
  }

  log('Received /api/query POST with body:', body)
  if (parseError) log('JSON parse error:', parseError)

  if (!body || !body.sql) {
    res.statusCode = 400
    return res.end(JSON.stringify({ message: 'Missing SQL in request body' }))
  }

  const dbConfigProvided = body.host && body.user && body.database
  if (!dbConfigProvided) {
    res.statusCode = 400
    return res.end(
      JSON.stringify({ message: 'Missing DB connection parameters' })
    )
  }

  const pool = mysql.createPool({
    host: body.host,
    user: body.user,
    password: body.password,
    database: body.database,
    port: body.port,
    multipleStatements: false,
  })

  let conn: any = null
  try {
    conn = await pool.getConnection()
    log('Connected for query')

    const sql = String(body.sql)
    const [rows, fields]: any = await conn.query(sql)

    // fields may be undefined for non-select queries
    const columns = Array.isArray(fields)
      ? fields.map((f: any) => ({
          name: f.name,
          columnType: f.columnType || f.type,
        }))
      : null

    res.statusCode = 200
    return res.end(JSON.stringify({ rows, columns }))
  } catch (error: any) {
    log('Query execution error:', error)
    res.statusCode = 500
    return res.end(
      JSON.stringify({ message: 'Query failed', error: String(error) })
    )
  } finally {
    try {
      if (conn) conn.release()
    } catch (e) {
      /* ignore */
    }
    try {
      await pool.end()
    } catch (e) {
      /* ignore */
    }
  }
}
