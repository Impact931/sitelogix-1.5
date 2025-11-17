/**
 * Test Login with Admin Account
 */

const https = require('https');

const API_URL = 'https://6f10uv7ne0.execute-api.us-east-1.amazonaws.com';

async function testLogin() {
  const loginData = {
    username: 'jayson@impactconsulting931.com',
    passcode: 'SiteLogix123$'
  };

  const data = JSON.stringify(loginData);

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(API_URL + '/api/auth/login', options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        console.log('\n🔐 Login Test Result\n');
        console.log('Status Code:', res.statusCode);
        console.log('Response:', JSON.stringify(JSON.parse(responseData), null, 2));

        if (res.statusCode === 200) {
          console.log('\n✅ Login SUCCESSFUL!');
        } else {
          console.log('\n❌ Login FAILED!');
        }

        resolve();
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request Error:', error);
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

testLogin().catch(console.error);
