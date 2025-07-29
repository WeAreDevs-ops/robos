import rp from 'request-promise';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { cookie, birthDay, birthMonth, birthYear, password } = req.body || {};

  if (!cookie || !birthDay || !birthMonth || !birthYear || !password) {
    return res.status(400).json({
      error: 'Missing required fields: cookie, birthDay, birthMonth, birthYear, password'
    });
  }

  let csrfToken = null;
  const endpoints = [
    'https://accountinformation.roblox.com/v1/birthdate',
    'https://auth.roblox.com/v2/logout',
    'https://friends.roblox.com/v1/users/1/friends'
  ];

  for (const endpoint of endpoints) {
    try {
      const csrfResponse = await rp({
        method: 'POST',
        uri: endpoint,
        headers: {
          'Cookie': `.ROBLOSECURITY=${cookie}`,
          'User-Agent': 'Mozilla/5.0',
          'Content-Type': 'application/json',
          'Referer': 'https://www.roblox.com/',
          'Origin': 'https://www.roblox.com'
        },
        body: {},
        json: true,
        resolveWithFullResponse: true,
        simple: false
      });

      csrfToken = csrfResponse.headers['x-csrf-token'];
      if (csrfToken) break;
    } catch (e) {
      continue;
    }
  }

  if (!csrfToken) {
    return res.status(400).json({
      error: 'Could not retrieve CSRF token',
      suggestion: 'Check .ROBLOSECURITY cookie'
    });
  }

  try {
    const response = await rp({
      method: 'POST',
      uri: 'https://accountinformation.roblox.com/v1/birthdate',
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'X-CSRF-Token': csrfToken,
        'User-Agent': 'Mozilla/5.0',
        'Content-Type': 'application/json',
        'Referer': 'https://www.roblox.com/',
        'Origin': 'https://www.roblox.com'
      },
      body: {
        birthDay: parseInt(birthDay),
        birthMonth: parseInt(birthMonth),
        birthYear: parseInt(birthYear),
        password
      },
      json: true,
      resolveWithFullResponse: true,
      simple: false
    });

    const { statusCode, body, headers } = response;

    if (statusCode === 200) {
      return res.status(200).json({
        success: true,
        message: 'Birthdate changed successfully',
        newBirthdate: `${birthMonth}/${birthDay}/${birthYear}`
      });
    }

    if (statusCode === 403) {
      const isChallenge = body?.errors?.some(error =>
        error.message?.toLowerCase().includes('challenge')
      );

      if (isChallenge) {
        return res.status(403).json({
          error: 'Security challenge required',
          challenge: true,
          details: body
        });
      } else {
        return res.status(403).json({
          error: 'Invalid CSRF token or auth failed',
          details: body
        });
      }
    }

    return res.status(statusCode).json({
      error: 'Request failed',
      details: body
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Unexpected error occurred',
      message: err.message
    });
  }
                          }
