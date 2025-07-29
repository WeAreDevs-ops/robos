const rp = require('request-promise');

module.exports = async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { cookie } = req.query;

  if (!cookie) {
    return res.status(400).json({ error: 'Missing .ROBLOSECURITY cookie in query' });
  }

  try {
    const response = await rp({
      method: 'POST',
      uri: 'https://auth.roblox.com/v2/logout',
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.roblox.com/',
        'Origin': 'https://www.roblox.com'
      },
      resolveWithFullResponse: true,
      simple: false
    });

    const csrfToken = response.headers['x-csrf-token'];

    if (!csrfToken) {
      return res.status(400).json({ error: 'Failed to retrieve CSRF token' });
    }

    return res.status(200).json({ csrfToken });
  } catch (err) {
    return res.status(500).json({
      error: 'Unexpected error occurred',
      message: err.message
    });
  }
}
