
const express = require('express');
const rp = require('request-promise');
const path = require('path');

const app = express();
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.get('/', (req, res) => {
  res.json({ message: 'Roblox Birthdate Changer API', status: 'online' });
});

app.post('/change-birthdate', async (req, res) => {
  try {
    const { cookie, birthDay, birthMonth, birthYear, password } = req.body;

    if (!cookie || !birthDay || !birthMonth || !birthYear || !password) {
      return res.status(400).json({ 
        error: 'Missing required fields: cookie, birthDay, birthMonth, birthYear, password' 
      });
    }

    // Get fresh CSRF token right before the request
    console.log('Getting fresh CSRF token for birthdate change...');
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
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
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
        if (csrfToken) {
          console.log(`Fresh CSRF token obtained from ${endpoint}`);
          break;
        }
      } catch (endpointError) {
        console.log(`Failed to get CSRF from ${endpoint}:`, endpointError.message);
        continue;
      }
    }

    if (!csrfToken) {
      return res.status(400).json({ 
        error: 'Could not retrieve fresh CSRF token',
        suggestion: 'Make sure your .ROBLOSECURITY cookie is valid and not expired'
      });
    }

    // Function to make the birthdate change request
    const makeBirthdateRequest = async (additionalHeaders = {}) => {
      return await rp({
        method: 'POST',
        uri: 'https://accountinformation.roblox.com/v1/birthdate',
        headers: {
          'Cookie': `.ROBLOSECURITY=${cookie}`,
          'X-CSRF-Token': csrfToken,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Content-Type': 'application/json',
          'Referer': 'https://www.roblox.com/',
          'Origin': 'https://www.roblox.com',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-site',
          ...additionalHeaders
        },
        body: {
          birthDay: parseInt(birthDay),
          birthMonth: parseInt(birthMonth),
          birthYear: parseInt(birthYear),
          password: password
        },
        json: true,
        resolveWithFullResponse: true,
        simple: false
      });
    };

    // Make initial request
    let response = await makeBirthdateRequest();

    // Check for challenge headers in 403 response
    if (response.statusCode === 403) {
      const challengeId = response.headers['rblx-challenge-id'];
      const challengeType = response.headers['rblx-challenge-type'];
      const challengeMetadata = response.headers['rblx-challenge-metadata'];

      if (challengeId && challengeType && challengeMetadata) {
        console.log('Challenge detected - attempting to solve via /v2/continue API');
        console.log(`Challenge ID: ${challengeId}`);
        console.log(`Challenge Type: ${challengeType}`);
        console.log(`Challenge Metadata: ${challengeMetadata}`);

        try {
          // Call the /v2/continue API to solve the challenge
          const continueResponse = await rp({
            method: 'POST',
            uri: 'https://apis.roblox.com/challenge/v1/continue',
            headers: {
              'Cookie': `.ROBLOSECURITY=${cookie}`,
              'X-CSRF-Token': csrfToken,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Content-Type': 'application/json',
              'Referer': 'https://www.roblox.com/',
              'Origin': 'https://www.roblox.com',
              'Accept': 'application/json, text/plain, */*',
              'Accept-Language': 'en-US,en;q=0.9',
              'Sec-Fetch-Dest': 'empty',
              'Sec-Fetch-Mode': 'cors',
              'Sec-Fetch-Site': 'same-site',
              'rblx-challenge-id': challengeId,
              'rblx-challenge-type': challengeType,
              'rblx-challenge-metadata': challengeMetadata
            },
            body: {
              challengeId: challengeId,
              challengeType: challengeType,
              challengeMetadata: challengeMetadata
            },
            json: true,
            resolveWithFullResponse: true,
            simple: false
          });

          console.log(`Continue API response status: ${continueResponse.statusCode}`);
          console.log(`Continue API response:`, JSON.stringify(continueResponse.body, null, 2));

          // If challenge was solved successfully, retry the original request
          if (continueResponse.statusCode === 200) {
            console.log('Challenge solved successfully - retrying birthdate change');
            
            // Extract any additional headers from the continue response that might be needed
            const additionalHeaders = {};
            if (continueResponse.headers['rblx-challenge-solution']) {
              additionalHeaders['rblx-challenge-solution'] = continueResponse.headers['rblx-challenge-solution'];
            }
            if (continueResponse.headers['rblx-challenge-id']) {
              additionalHeaders['rblx-challenge-id'] = continueResponse.headers['rblx-challenge-id'];
            }

            // Retry the original request with challenge solution headers
            response = await makeBirthdateRequest(additionalHeaders);
            console.log(`Retry response status: ${response.statusCode}`);
          } else {
            console.log('Challenge solving failed');
          }
        } catch (challengeError) {
          console.error('Error solving challenge:', challengeError.message);
        }
      }
    }

    console.log(`Birthdate change response status: ${response.statusCode}`);
    console.log(`Response headers:`, JSON.stringify(response.headers, null, 2));
    console.log(`Response body:`, JSON.stringify(response.body, null, 2));
    
    // Decode challenge details if present
    if (response.body && response.body.errors) {
      console.log('\n=== CHALLENGE ANALYSIS ===');
      response.body.errors.forEach((error, index) => {
        console.log(`Error ${index + 1}:`);
        console.log(`  Code: ${error.code}`);
        console.log(`  Message: ${error.message}`);
        
        // Check for additional challenge metadata
        if (error.userFacingMessage) {
          console.log(`  User Facing Message: ${error.userFacingMessage}`);
        }
        if (error.field) {
          console.log(`  Field: ${error.field}`);
        }
        if (error.retryable) {
          console.log(`  Retryable: ${error.retryable}`);
        }
      });
      
      // Look for challenge-specific headers
      const challengeHeaders = Object.keys(response.headers).filter(key => 
        key.toLowerCase().includes('challenge') || 
        key.toLowerCase().includes('captcha') ||
        key.toLowerCase().includes('verification')
      );
      
      if (challengeHeaders.length > 0) {
        console.log('\n=== CHALLENGE HEADERS ===');
        challengeHeaders.forEach(header => {
          console.log(`${header}: ${response.headers[header]}`);
        });
      }
      
      // Check if there's a challenge ID or token in the response
      if (response.body.challengeId) {
        console.log(`\nChallenge ID: ${response.body.challengeId}`);
      }
      if (response.body.challengeType) {
        console.log(`Challenge Type: ${response.body.challengeType}`);
      }
      if (response.body.challengeMetadata) {
        console.log(`Challenge Metadata:`, JSON.stringify(response.body.challengeMetadata, null, 2));
      }
    }

    if (response.statusCode === 200) {
      res.json({ 
        success: true, 
        message: 'Birthdate changed successfully',
        newBirthdate: `${birthMonth}/${birthDay}/${birthYear}`
      });
    } else if (response.statusCode === 403) {
      // Check if it's a challenge requirement
      const responseBody = response.body;
      const isChallenge = responseBody && responseBody.errors && 
        responseBody.errors.some(error => error.message && error.message.toLowerCase().includes('challenge'));
      
      if (isChallenge) {
        res.status(403).json({ 
          error: 'Roblox security challenge required',
          challenge: true,
          suggestion: 'Roblox now requires additional verification (like captcha/2FA) for birthdate changes. This cannot be bypassed through the API.',
          details: response.body,
          recommendation: 'You must change your birthdate manually through the Roblox website.'
        });
      } else {
        res.status(403).json({ 
          error: 'Invalid CSRF token or authentication failed',
          suggestion: 'Your cookie might be expired or invalid. Try getting a fresh cookie from roblox.com',
          details: response.body
        });
      }
    } else if (response.statusCode === 400) {
      res.status(400).json({ 
        error: 'Invalid request data or wrong password',
        details: response.body,
        suggestion: 'Check if your password is correct and birthdate values are valid'
      });
    } else {
      res.status(response.statusCode).json({ 
        error: 'Request failed',
        statusCode: response.statusCode,
        body: response.body
      });
    }

  } catch (error) {
    console.error('Error changing birthdate:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});

app.get('/get-csrf', async (req, res) => {
  try {
    const { cookie } = req.query;
    
    if (!cookie) {
      return res.status(400).json({ error: 'Cookie parameter is required' });
    }

    // Try multiple endpoints to get CSRF token
    const endpoints = [
      'https://auth.roblox.com/v2/logout',
      'https://accountinformation.roblox.com/v1/birthdate',
      'https://friends.roblox.com/v1/users/1/friends'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await rp({
          method: 'POST',
          uri: endpoint,
          headers: {
            'Cookie': `.ROBLOSECURITY=${cookie}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Content-Type': 'application/json',
            'Referer': 'https://www.roblox.com/',
            'Origin': 'https://www.roblox.com'
          },
          body: {},
          json: true,
          resolveWithFullResponse: true,
          simple: false
        });

        const csrfToken = response.headers['x-csrf-token'];
        
        if (csrfToken) {
          console.log(`CSRF token retrieved from ${endpoint}`);
          return res.json({ 
            csrf: csrfToken,
            source: endpoint,
            statusCode: response.statusCode
          });
        }
      } catch (endpointError) {
        console.log(`Failed to get CSRF from ${endpoint}:`, endpointError.message);
        continue;
      }
    }

    // If no CSRF token found from any endpoint
    res.status(400).json({ 
      error: 'Could not retrieve CSRF token from any endpoint',
      suggestion: 'Make sure your .ROBLOSECURITY cookie is valid and not expired'
    });

  } catch (error) {
    console.error('Error getting CSRF token:', error);
    res.status(500).json({ 
      error: 'Failed to get CSRF token',
      message: error.message
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
