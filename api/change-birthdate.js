const rp = require('request-promise');

// Helper function to add delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { cookie, birthDay, birthMonth, birthYear, password } = req.body || {};

  if (!cookie || !birthDay || !birthMonth || !birthYear || !password) {
    return res.status(400).json({
      error: 'Missing required fields: cookie, birthDay, birthMonth, birthYear, password'
    });
  }

  // Add delay to appear more human-like
  await delay(2000 + Math.random() * 3000);

  let csrfToken = null;
  const baseHeaders = {
    'Cookie': `.ROBLOSECURITY=${cookie}`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9,en-GB;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Referer': 'https://www.roblox.com/my/account#!/info',
    'Origin': 'https://www.roblox.com',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-GPC': '1',
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache',
    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-ch-ua-platform-version': '"15.0.0"',
    'sec-ch-ua-arch': '"x86"',
    'sec-ch-ua-model': '""',
    'sec-ch-ua-bitness': '"64"',
    'sec-ch-ua-full-version': '"131.0.6778.108"',
    'sec-ch-ua-full-version-list': '"Google Chrome";v="131.0.6778.108", "Chromium";v="131.0.6778.108", "Not_A Brand";v="24.0.0.0"',
    'sec-ch-ua-wow64': '?0',
    'upgrade-insecure-requests': '1',
    'viewport-width': '1920',
    'x-client-data': 'CIe2yQEIorbJAQipncoBCKmdygEIlKHKAQiVocoB',
    'x-same-domain': '1'
  };

  // Try to get CSRF token from the birthdate endpoint first
  try {
    const csrfResponse = await rp({
      method: 'POST',
      uri: 'https://accountinformation.roblox.com/v1/birthdate',
      headers: {
        ...baseHeaders,
        'Content-Type': 'application/json;charset=utf-8'
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

    csrfToken = csrfResponse.headers['x-csrf-token'];
    
    // If we got a 200 response on first try (rare but possible)
    if (csrfResponse.statusCode === 200) {
      return res.status(200).json({
        success: true,
        message: 'Birthdate changed successfully',
        newBirthdate: `${birthMonth}/${birthDay}/${birthYear}`
      });
    }
  } catch (e) {
    // Continue to fallback endpoints
  }

  // Fallback endpoints if CSRF token wasn't retrieved
  if (!csrfToken) {
    const endpoints = [
      'https://auth.roblox.com/v2/logout',
      'https://friends.roblox.com/v1/users/1/friends'
    ];

    for (const endpoint of endpoints) {
      try {
        await delay(500); // Small delay between requests
        
        const csrfResponse = await rp({
          method: 'POST',
          uri: endpoint,
          headers: {
            ...baseHeaders,
            'Content-Type': 'application/json;charset=utf-8'
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
  }

  if (!csrfToken) {
    return res.status(400).json({
      error: 'Could not retrieve CSRF token',
      suggestion: 'Cookie may be invalid or expired'
    });
  }

  // Add delay before main request
  await delay(3000 + Math.random() * 2000);

  try {
    const response = await rp({
      method: 'POST',
      uri: 'https://accountinformation.roblox.com/v1/birthdate',
      headers: {
        ...baseHeaders,
        'Content-Type': 'application/json;charset=utf-8',
        'X-CSRF-Token': csrfToken
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

    const { statusCode, body } = response;

    if (statusCode === 200) {
      return res.status(200).json({
        success: true,
        message: 'Birthdate changed successfully',
        newBirthdate: `${birthMonth}/${birthDay}/${birthYear}`
      });
    }

    if (statusCode === 403) {
      // Check for specific error messages
      if (body?.errors) {
        const errorMessages = body.errors.map(e => e.message).join(', ');
        
        if (errorMessages.toLowerCase().includes('challenge')) {
          return res.status(403).json({
            error: 'Security challenge required - please complete it in your browser first',
            challenge: true,
            details: body
          });
        }
        
        if (errorMessages.toLowerCase().includes('password')) {
          return res.status(403).json({
            error: 'Incorrect password provided',
            details: body
          });
        }
        
        if (errorMessages.toLowerCase().includes('token')) {
          return res.status(403).json({
            error: 'CSRF token expired - please try again',
            details: body
          });
        }
        
        return res.status(403).json({
          error: `Request failed: ${errorMessages}`,
          details: body
        });
      }
      
      return res.status(403).json({
        error: 'Access forbidden - please check your credentials',
        details: body
      });
    }

    if (statusCode === 429) {
      return res.status(429).json({
        error: 'Rate limited - please wait and try again later',
        details: body
      });
    }

    return res.status(statusCode).json({
      error: `Request failed with status ${statusCode}`,
      details: body
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Unexpected error occurred',
      message: err.message
    });
  }
}
