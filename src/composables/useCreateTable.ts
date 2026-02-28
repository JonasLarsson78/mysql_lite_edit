export async function createTableRequest(
  conn: any,
  tableName: string,
  columns: any[]
) {
  const payload = {
    host: conn.host,
    user: conn.user,
    password: conn.password,
    database: conn.database,
    port: conn.port,
    tableName,
    columns,
  }
  const res = await fetch('/api/create-table', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || 'Create table failed')
  return data
}
