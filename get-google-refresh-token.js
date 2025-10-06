/**
 * Google OAuth 2.0 Refresh Token Helper
 *
 * This script helps you get a refresh token for Google Sheets API access.
 * Run: node get-google-refresh-token.js
 */

const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const open = require('open');

// Load credentials from .env
require('dotenv').config();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.Google_Client_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_Secret;
const REDIRECT_URI = 'http://localhost:3000/oauth/callback';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file'
];

async function getRefreshToken() {
  console.log('='.repeat(80));
  console.log('🔐 Google OAuth 2.0 - Get Refresh Token');
  console.log('='.repeat(80));
  console.log('');
  console.log('Client ID:', CLIENT_ID);
  console.log('Client Secret:', CLIENT_SECRET ? '***' + CLIENT_SECRET.slice(-4) : 'NOT FOUND');
  console.log('Redirect URI:', REDIRECT_URI);
  console.log('');

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ Error: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env');
    process.exit(1);
  }

  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );

  // Generate auth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Force consent to get refresh token
  });

  console.log('📋 Steps:');
  console.log('1. A browser window will open (or copy the URL below)');
  console.log('2. Sign in with your Google account');
  console.log('3. Grant permissions to SiteLogix');
  console.log('4. You will be redirected to localhost:3000');
  console.log('5. The refresh token will be displayed here');
  console.log('');
  console.log('Authorization URL:');
  console.log(authUrl);
  console.log('');

  // Create a local server to receive the OAuth callback
  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = url.parse(req.url, true);

      if (parsedUrl.pathname === '/oauth/callback') {
        const code = parsedUrl.query.code;

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Error: No authorization code received</h1>');
          return;
        }

        console.log('✅ Authorization code received!');
        console.log('🔄 Exchanging code for tokens...');

        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        console.log('');
        console.log('='.repeat(80));
        console.log('✅ SUCCESS! Tokens received');
        console.log('='.repeat(80));
        console.log('');
        console.log('Add these to your .env file:');
        console.log('');
        console.log('GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token);
        console.log('GOOGLE_ACCESS_TOKEN=' + tokens.access_token);
        console.log('');
        console.log('⚠️  IMPORTANT: Save the GOOGLE_REFRESH_TOKEN securely!');
        console.log('   Access tokens expire, but refresh tokens can be used indefinitely.');
        console.log('');
        console.log('='.repeat(80));

        // Send success response to browser
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <head><title>OAuth Success</title></head>
            <body style="font-family: sans-serif; max-width: 800px; margin: 50px auto; padding: 20px;">
              <h1 style="color: #4CAF50;">✅ Authorization Successful!</h1>
              <p>You can close this window and return to the terminal.</p>
              <h2>Refresh Token:</h2>
              <pre style="background: #f5f5f5; padding: 15px; overflow-x: auto;">${tokens.refresh_token}</pre>
              <p><strong>Copy the refresh token above and add it to your .env file:</strong></p>
              <code>GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}</code>
            </body>
          </html>
        `);

        // Close server
        setTimeout(() => {
          server.close();
          process.exit(0);
        }, 1000);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>');
      }
    } catch (error) {
      console.error('❌ Error during OAuth callback:', error);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`<h1>Error: ${error.message}</h1>`);
      server.close();
      process.exit(1);
    }
  });

  // Start server
  server.listen(3000, () => {
    console.log('🌐 Local server started on http://localhost:3000');
    console.log('⏳ Waiting for authorization...');
    console.log('');

    // Open browser
    open(authUrl).catch(err => {
      console.log('⚠️  Could not open browser automatically.');
      console.log('   Please open the URL above manually.');
    });
  });

  // Handle server errors
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error('❌ Error: Port 3000 is already in use.');
      console.error('   Please stop any other services using port 3000 and try again.');
    } else {
      console.error('❌ Server error:', error);
    }
    process.exit(1);
  });
}

// Run
getRefreshToken().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
