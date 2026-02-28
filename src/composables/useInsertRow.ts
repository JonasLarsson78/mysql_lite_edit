export async function insertRowRequest(conn: any, tableName: string, row: any) {
  const payload = {
    host: conn.host,
    user: conn.user,
    password: conn.password,
    database: conn.database,
    port: conn.port,
    tableName,
    row,
  }
  const res = await fetch('/api/insert-row', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || 'Insert row failed')
  return data
}
