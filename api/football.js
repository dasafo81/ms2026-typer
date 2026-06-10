export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const { endpoint } = req.query
  if (!endpoint) {
    return res.status(400).json({ error: 'Missing endpoint' })
  }

  const url = `https://api.football-data.org/v4${endpoint}`

  try {
    const response = await fetch(url, {
      headers: {
        'X-Auth-Token': process.env.VITE_FOOTBALL_DATA_KEY
      }
    })

    const data = await response.json()
    return res.status(response.status).json(data)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
