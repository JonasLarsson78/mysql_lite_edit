import mysql from 'mysql2/promise'
import path from 'path'
import dotenv from 'dotenv'
import type {
  IncomingMessage as VercelRequest,
  ServerResponse as VercelResponse,
} from 'http'
import { log } from 'console'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let body: any = {}
  let rawData = ''
  let parseError: any = null
  const contentType = req.headers['content-type'] || ''

  // Prefer pre-parsed `req.body` when available, but accessing it may
  // cause some dev servers (Vercel) to attempt parsing and throw.
  // Wrap in try/catch to avoid crashing the handler.
  try {
    const maybeBody = (req as any).body
    if (maybeBody && Object.keys(maybeBody).length !== 0) {
      body = maybeBody
      log('Using pre-parsed req.body from middleware:', body)
    } else {
      for await (const chunk of req) {
        rawData += chunk
      }
      try {
        body = JSON.parse(rawData || '{}')
      } catch (e) {
        parseError = e
        body = {}
      }
    }
  } catch (e) {
    // Accessing `req.body` threw (dev server tried to parse invalid JSON).
    log(
      'Accessing req.body threw, will attempt to stream raw body:',
      typeof e === 'object' && e !== null && 'message' in e
        ? (e as any).message
        : String(e)
    )
    parseError = e
    try {
      for await (const chunk of req) {
        rawData += chunk
      }
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
  const db =
    Object.keys(body).length !== 0
      ? mysql.createPool({
          host: body.host,
          user: body.user,
          password: body.password,
          database: body.database,
          port: body.port,
        })
      : null

  if (req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json')
    log('Received POST request with body:', body)
    log('Raw body:', rawData)
    log('Content-Type:', contentType)
    if (parseError) {
      log('Failed to parse JSON body:', parseError.message || parseError)
    }

    if (db) {
      let conn: any = null
      try {
        conn = await db.getConnection()
        log('Connected to MySQL database successfully!')

        // Get list of tables in the database
        const [tablesRows]: any = await conn.query(
          'SELECT table_name FROM information_schema.tables WHERE table_schema = ?',
          [body.database]
        )

        const tables: any[] = []
        const rowLimit = typeof body.rowLimit === 'number' ? body.rowLimit : 100

        for (const t of tablesRows) {
          const tableName =
            t.TABLE_NAME || t.table_name || t.Table_name || t.TABLE_NAME
          // Get columns and types
          const [colsRows]: any = await conn.query(
            'SELECT column_name, data_type, column_type, is_nullable FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position',
            [body.database, tableName]
          )

          // Get rows (limited)
          const [rows]: any = await conn.query(
            `SELECT * FROM \`${tableName}\` LIMIT ?`,
            [rowLimit]
          )

          tables.push({
            name: tableName,
            columns: colsRows.map((c: any) => ({
              name: c.COLUMN_NAME || c.column_name,
              data_type: c.DATA_TYPE || c.data_type,
              column_type: c.COLUMN_TYPE || c.column_type,
              is_nullable: c.IS_NULLABLE || c.is_nullable,
            })),
            rows,
          })
        }

        res.statusCode = 200
        return res.end(JSON.stringify({ database: body.database, tables }))
      } catch (error) {
        log('Error connecting to MySQL database:', error)
        res.statusCode = 500
        return res.end(
          JSON.stringify({
            message: 'Failed to connect to MySQL database.',
            error: String(error),
          })
        )
      } finally {
        try {
          if (conn) conn.release()
        } catch (e) {
          /* ignore */
        }
      }
    } else {
      if (rawData.trim().length > 0 && parseError) {
        log('Invalid JSON received; replying with parse error.')
        res.statusCode = 400
        return res.end(
          JSON.stringify({
            message: 'Invalid JSON body',
            error: parseError.message,
          })
        )
      }
      log('No database configuration provided.')
      res.statusCode = 400
      return res.end(
        JSON.stringify({ message: 'No database configuration provided.' })
      )
    }
  } else if (req.method === 'PATCH') {
    res.setHeader('Content-Type', 'application/json')
    res.statusCode = 200
    res.end(JSON.stringify({ message: 'PATCH request received!' }))
  } else {
    res.setHeader('Content-Type', 'application/json')
    res.statusCode = 405
    res.end(JSON.stringify({ message: 'Method Not Allowed' }))
  }
}
