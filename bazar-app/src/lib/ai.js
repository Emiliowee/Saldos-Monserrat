import Anthropic from '@anthropic-ai/sdk'

/**
 * ⚠️ Seguridad: no uses la API key en el renderer en producción.
 * Mové las llamadas a Anthropic al proceso principal (IPC) y guardá la key fuera del bundle.
 * Esta función es solo para prototipar con `VITE_ANTHROPIC_KEY` en desarrollo.
 */
export async function suggestProduct(tags, existingProducts = []) {
  const key = import.meta.env.VITE_ANTHROPIC_KEY
  if (!key) {
    console.warn('suggestProduct: falta VITE_ANTHROPIC_KEY')
    return null
  }

  const client = new Anthropic({
    apiKey: key,
    dangerouslyAllowBrowser: true,
  })

  const similar = existingProducts
    .filter((p) => p.tags?.some((t) => tags.includes(t)))
    .slice(0, 15)

  const response = await client.messages.create({
    model: 'claude-3-5-haiku-latest',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `Eres un asistente para un bazar de ropa en México.

Tags del nuevo producto: ${tags.join(', ')}

Productos similares en inventario (referencia de precios):
${similar.map((p) => `- ${p.name}: $${p.price} [${(p.tags || []).join(', ')}]`).join('\n')}

Sugiere para el nuevo producto:
- nombre: nombre descriptivo del artículo
- precio: precio sugerido en pesos MXN (número)
- temporada: Primavera-Verano o Otoño-Invierno

Responde SOLO con JSON válido, sin texto adicional.
Ejemplo: {"nombre":"Pantalón Nike talla M","precio":180,"temporada":"Primavera-Verano"}`,
      },
    ],
  })

  const text = response.content?.[0]?.text
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
