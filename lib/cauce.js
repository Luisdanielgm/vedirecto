// Cliente mínimo de Cauce (OpenAI-compatible). Lee la config de env.
export async function cauceChat(messages, { timeoutMs = 30000 } = {}) {
  const key = process.env.CAUCE_API_KEY
  if (!key) throw new Error('CAUCE_API_KEY no configurada')
  const base = process.env.CAUCE_BASE_URL || 'https://api.cauce.me/v1'
  const model = process.env.CAUCE_MODEL || 'deepseek-v4-flash'

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'X-Cauce-App': 'vedirecto.alta',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`Cauce ${res.status}: ${t.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}
