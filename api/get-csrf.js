import rp from 'request-promise';

export default async function handler(req, res) {
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
        'User-Agent': 'Mozilla/5.0',
        'Content-Type': 'application/json'
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
