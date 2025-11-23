/**
 * Test file for Cognito Authentication
 *
 * This file demonstrates how to test the Cognito authentication functions.
 * Run with: node cognito-auth.test.js
 *
 * IMPORTANT: These are integration tests that will make actual AWS API calls.
 * Make sure you have valid AWS credentials configured.
 */

const {
  handleCognitoLogin,
  handleCognitoRefresh,
  handleCognitoLogout,
  verifyCognitoToken,
  getCurrentUser
} = require('./cognito-auth');

const {
  createCognitoUser,
  updateCognitoUser,
  addUserToGroup,
  resetPassword,
  changePassword,
  getCognitoUser,
  listCognitoUsers
} = require('./cognito-user-management');

// Test configuration
const TEST_CONFIG = {
  // Replace with actual test user credentials
  testEmail: 'test@example.com',
  testPassword: 'TestPassword123!',

  // For creating new test users
  newUserEmail: 'newuser@example.com',
  newUserPassword: 'NewPassword123!',
  newUserFirstName: 'Test',
  newUserLastName: 'User'
};

/**
 * Helper function to run tests
 */
async function runTests() {
  console.log('='.repeat(80));
  console.log('AWS COGNITO AUTHENTICATION TESTS');
  console.log('='.repeat(80));
  console.log();

  let accessToken = null;
  let refreshToken = null;
  let testUserId = null;

  // =========================================================================
  // TEST 1: User Login
  // =========================================================================
  console.log('TEST 1: User Login');
  console.log('-'.repeat(80));
  try {
    const loginResult = await handleCognitoLogin(
      TEST_CONFIG.testEmail,
      TEST_CONFIG.testPassword
    );

    if (loginResult.success) {
      console.log('✓ Login successful');
      console.log('  User ID:', loginResult.user.userId);
      console.log('  Email:', loginResult.user.email);
      console.log('  Role:', loginResult.user.role);
      console.log('  Groups:', loginResult.user.groups);
      console.log('  Person ID:', loginResult.user.personId);
      console.log('  Access Token:', loginResult.accessToken.substring(0, 50) + '...');

      // Save tokens for subsequent tests
      accessToken = loginResult.accessToken;
      refreshToken = loginResult.refreshToken;
      testUserId = loginResult.user.userId;
    } else {
      console.log('✗ Login failed:', loginResult.error);
      console.log('  Code:', loginResult.code);
    }
  } catch (error) {
    console.log('✗ Login error:', error.message);
  }
  console.log();

  // =========================================================================
  // TEST 2: Verify Access Token
  // =========================================================================
  console.log('TEST 2: Verify Access Token');
  console.log('-'.repeat(80));
  if (accessToken) {
    try {
      const verifyResult = await verifyCognitoToken(accessToken, 'access');

      if (verifyResult.success) {
        console.log('✓ Token verification successful');
        console.log('  User ID:', verifyResult.user.userId);
        console.log('  Email:', verifyResult.user.email);
        console.log('  Token Expires:', verifyResult.user.tokenExpires);
      } else {
        console.log('✗ Token verification failed:', verifyResult.error);
      }
    } catch (error) {
      console.log('✗ Token verification error:', error.message);
    }
  } else {
    console.log('⊘ Skipped - No access token available');
  }
  console.log();

  // =========================================================================
  // TEST 3: Get Current User
  // =========================================================================
  console.log('TEST 3: Get Current User');
  console.log('-'.repeat(80));
  if (accessToken) {
    try {
      const userResult = await getCurrentUser(accessToken);

      if (userResult.success) {
        console.log('✓ Get current user successful');
        console.log('  User ID:', userResult.user.userId);
        console.log('  Username:', userResult.user.username);
        console.log('  Email:', userResult.user.email);
        console.log('  First Name:', userResult.user.firstName);
        console.log('  Last Name:', userResult.user.lastName);
        console.log('  Role:', userResult.user.role);
      } else {
        console.log('✗ Get current user failed:', userResult.error);
      }
    } catch (error) {
      console.log('✗ Get current user error:', error.message);
    }
  } else {
    console.log('⊘ Skipped - No access token available');
  }
  console.log();

  // =========================================================================
  // TEST 4: Refresh Token
  // =========================================================================
  console.log('TEST 4: Refresh Token');
  console.log('-'.repeat(80));
  if (refreshToken) {
    try {
      const refreshResult = await handleCognitoRefresh(refreshToken);

      if (refreshResult.success) {
        console.log('✓ Token refresh successful');
        console.log('  New Access Token:', refreshResult.accessToken.substring(0, 50) + '...');
        console.log('  Expires In:', refreshResult.expiresIn, 'seconds');

        // Update access token for subsequent tests
        accessToken = refreshResult.accessToken;
      } else {
        console.log('✗ Token refresh failed:', refreshResult.error);
        console.log('  Code:', refreshResult.code);
      }
    } catch (error) {
      console.log('✗ Token refresh error:', error.message);
    }
  } else {
    console.log('⊘ Skipped - No refresh token available');
  }
  console.log();

  // =========================================================================
  // TEST 5: List Users (Admin Operation)
  // =========================================================================
  console.log('TEST 5: List Users (Admin Operation)');
  console.log('-'.repeat(80));
  try {
    const listResult = await listCognitoUsers({ limit: 5 });

    if (listResult.success) {
      console.log('✓ List users successful');
      console.log('  Total users retrieved:', listResult.users.length);
      listResult.users.forEach((user, index) => {
        console.log(`  User ${index + 1}:`);
        console.log('    Email:', user.email);
        console.log('    Role:', user.role);
        console.log('    Status:', user.status);
      });
    } else {
      console.log('✗ List users failed:', listResult.error);
    }
  } catch (error) {
    console.log('✗ List users error:', error.message);
  }
  console.log();

  // =========================================================================
  // TEST 6: Get User Details (Admin Operation)
  // =========================================================================
  console.log('TEST 6: Get User Details (Admin Operation)');
  console.log('-'.repeat(80));
  if (TEST_CONFIG.testEmail) {
    try {
      const getUserResult = await getCognitoUser(TEST_CONFIG.testEmail);

      if (getUserResult.success) {
        console.log('✓ Get user details successful');
        console.log('  User ID:', getUserResult.user.userId);
        console.log('  Email:', getUserResult.user.email);
        console.log('  First Name:', getUserResult.user.firstName);
        console.log('  Last Name:', getUserResult.user.lastName);
        console.log('  Role:', getUserResult.user.role);
        console.log('  Groups:', getUserResult.user.groups);
        console.log('  Status:', getUserResult.user.status);
        console.log('  Enabled:', getUserResult.user.enabled);
      } else {
        console.log('✗ Get user details failed:', getUserResult.error);
      }
    } catch (error) {
      console.log('✗ Get user details error:', error.message);
    }
  } else {
    console.log('⊘ Skipped - No test email configured');
  }
  console.log();

  // =========================================================================
  // TEST 7: Logout
  // =========================================================================
  console.log('TEST 7: Logout');
  console.log('-'.repeat(80));
  if (accessToken) {
    try {
      const logoutResult = await handleCognitoLogout(accessToken);

      if (logoutResult.success) {
        console.log('✓ Logout successful');
        console.log('  Message:', logoutResult.message);
      } else {
        console.log('✗ Logout failed:', logoutResult.error);
        console.log('  Code:', logoutResult.code);
      }
    } catch (error) {
      console.log('✗ Logout error:', error.message);
    }
  } else {
    console.log('⊘ Skipped - No access token available');
  }
  console.log();

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  console.log('Tests completed. Review results above.');
  console.log();
  console.log('IMPORTANT NOTES:');
  console.log('1. Make sure test users exist in your Cognito User Pool');
  console.log('2. Update TEST_CONFIG with actual test credentials');
  console.log('3. Admin operations require appropriate IAM permissions');
  console.log('4. Tokens are invalidated after logout');
  console.log();
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests };
