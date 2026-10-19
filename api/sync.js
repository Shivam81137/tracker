// Vercel Serverless Function for SyncOrbit Cross-Device Fallback Sync
let inMemoryState = null
let lastModified = Date.now()

export default async function handler(req, res) {
  // Enable CORS so client requests never get blocked
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    if (req.method === 'GET') {
      if (!inMemoryState) {
        return res.status(200).json({ empty: true, updatedAt: lastModified })
      }
      return res.status(200).json({ state: inMemoryState, updatedAt: lastModified })
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      if (payload && (payload.tasks || payload.version || payload.state)) {
        inMemoryState = payload.state || payload
        lastModified = Date.now()
        return res.status(200).json({ success: true, updatedAt: lastModified })
      }
      return res.status(400).json({ error: 'Invalid state payload' })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
