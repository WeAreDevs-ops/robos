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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9,en-GB;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Referer': 'https://www.roblox.com/',
        'Origin': 'https://www.roblox.com',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-ch-ua-platform-version': '"15.0.0"',
        'sec-ch-ua-arch': '"x86"',
        'sec-ch-ua-bitness': '"64"',
        'sec-ch-ua-full-version': '"131.0.6778.108"',
        'upgrade-insecure-requests': '1',
        'x-client-data': 'CIe2yQEIorbJAQipncoBCKmdygEIlKHKAQiVocoB',
        'x-same-domain': '1'
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
