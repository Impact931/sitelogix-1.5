/**
 * AWS Cognito Authentication Module
 *
 * Handles user authentication with AWS Cognito User Pool
 * - Sign in with username/password
 * - Token refresh
 * - Sign out
 * - Token verification and validation
 *
 * @module cognito-auth
 */

const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  GlobalSignOutCommand,
  GetUserCommand
} = require('@aws-sdk/client-cognito-identity-provider');
const { CognitoJwtVerifier } = require('aws-jwt-verify');
const crypto = require('crypto');

// Cognito configuration
const COGNITO_CONFIG = {
  userPoolId: 'us-east-1_tPkj4vb3A',
  clientId: '7rsb6cnpp86cdgtv3h9j6c8t75',
  clientSecret: 'vofaujel798h2iu5decko25cqa0ndubp3hnvdbvdtcjinge2v8i',
  region: 'us-east-1'
};

// Initialize Cognito client
const cognitoClient = new CognitoIdentityProviderClient({
  region: COGNITO_CONFIG.region
});

// Initialize JWT verifiers (access token and ID token)
const accessTokenVerifier = CognitoJwtVerifier.create({
  userPoolId: COGNITO_CONFIG.userPoolId,
  tokenUse: 'access',
  clientId: COGNITO_CONFIG.clientId,
});

const idTokenVerifier = CognitoJwtVerifier.create({
  userPoolId: COGNITO_CONFIG.userPoolId,
  tokenUse: 'id',
  clientId: COGNITO_CONFIG.clientId,
});

/**
 * Generate SECRET_HASH for Cognito authentication
 * Required when app client has a client secret
 */
function generateSecretHash(username) {
  const message = username + COGNITO_CONFIG.clientId;
  const hmac = crypto.createHmac('sha256', COGNITO_CONFIG.clientSecret);
  hmac.update(message);
  return hmac.digest('base64');
}

/**
 * Sign in user with Cognito
 *
 * @param {string} email - User's email address (used as username)
 * @param {string} password - User's password
 * @returns {Promise<Object>} Authentication result with tokens and user info
 */
async function handleCognitoLogin(email, password) {
  try {
    if (!email || !password) {
      return {
        success: false,
        error: 'Email and password are required',
        code: 'VALIDATION_ERROR'
      };
    }

    // Generate SECRET_HASH
    const secretHash = generateSecretHash(email);

    // Initiate authentication
    const command = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: COGNITO_CONFIG.clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
        SECRET_HASH: secretHash
      }
    });

    const response = await cognitoClient.send(command);

    // Check if challenge is required (e.g., NEW_PASSWORD_REQUIRED)
    if (response.ChallengeName) {
      return {
        success: false,
        error: `Authentication challenge required: ${response.ChallengeName}`,
        code: 'CHALLENGE_REQUIRED',
        challengeName: response.ChallengeName,
        session: response.Session
      };
    }

    // Extract tokens
    const {
      AccessToken,
      IdToken,
      RefreshToken,
      ExpiresIn
    } = response.AuthenticationResult;

    // Decode ID token to get user attributes
    const idTokenPayload = await idTokenVerifier.verify(IdToken);

    // Extract custom attributes from ID token
    const user = {
      userId: idTokenPayload.sub, // Cognito user ID
      email: idTokenPayload.email,
      emailVerified: idTokenPayload.email_verified || false,

      // Custom attributes (prefixed with custom: in Cognito)
      personId: idTokenPayload['custom:personId'] || null,
      employeeNumber: idTokenPayload['custom:employeeNumber'] || null,
      firstName: idTokenPayload['custom:firstName'] || idTokenPayload.given_name || null,
      lastName: idTokenPayload['custom:lastName'] || idTokenPayload.family_name || null,
      nickName: idTokenPayload['custom:nickName'] || idTokenPayload.nickname || null,
      role: idTokenPayload['custom:role'] || 'employee',

      // Cognito groups (used for role-based access)
      groups: idTokenPayload['cognito:groups'] || [],

      // Token metadata
      username: idTokenPayload['cognito:username'],
      tokenIssued: new Date(idTokenPayload.iat * 1000).toISOString(),
      tokenExpires: new Date(idTokenPayload.exp * 1000).toISOString()
    };

    return {
      success: true,
      user,
      accessToken: AccessToken,
      idToken: IdToken,
      refreshToken: RefreshToken,
      expiresIn: ExpiresIn
    };

  } catch (error) {
    console.error('Cognito login error:', error);

    // Handle specific Cognito errors
    if (error.name === 'NotAuthorizedException') {
      return {
        success: false,
        error: 'Invalid email or password',
        code: 'AUTH_FAILED'
      };
    }

    if (error.name === 'UserNotConfirmedException') {
      return {
        success: false,
        error: 'User account not confirmed. Please verify your email.',
        code: 'USER_NOT_CONFIRMED'
      };
    }

    if (error.name === 'UserNotFoundException') {
      return {
        success: false,
        error: 'Invalid email or password',
        code: 'AUTH_FAILED'
      };
    }

    if (error.name === 'PasswordResetRequiredException') {
      return {
        success: false,
        error: 'Password reset required',
        code: 'PASSWORD_RESET_REQUIRED'
      };
    }

    if (error.name === 'TooManyRequestsException') {
      return {
        success: false,
        error: 'Too many login attempts. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      };
    }

    return {
      success: false,
      error: 'Authentication failed',
      code: 'INTERNAL_ERROR',
      details: error.message
    };
  }
}

/**
 * Refresh access token using refresh token
 *
 * @param {string} refreshToken - Valid refresh token from previous login
 * @returns {Promise<Object>} New access and ID tokens
 */
async function handleCognitoRefresh(refreshToken) {
  try {
    if (!refreshToken) {
      return {
        success: false,
        error: 'Refresh token is required',
        code: 'VALIDATION_ERROR'
      };
    }

    // First, verify the current ID token to get the username for SECRET_HASH
    // Note: We need the username to generate SECRET_HASH, but we don't have it from refresh token
    // We'll use a workaround by getting user from the refresh token session

    const command = new InitiateAuthCommand({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: COGNITO_CONFIG.clientId,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
        // Note: SECRET_HASH not required for REFRESH_TOKEN_AUTH with some configurations
      }
    });

    const response = await cognitoClient.send(command);

    const {
      AccessToken,
      IdToken,
      ExpiresIn
    } = response.AuthenticationResult;

    // Decode new ID token
    const idTokenPayload = await idTokenVerifier.verify(IdToken);

    // Extract user info from refreshed token
    const user = {
      userId: idTokenPayload.sub,
      email: idTokenPayload.email,
      emailVerified: idTokenPayload.email_verified || false,
      personId: idTokenPayload['custom:personId'] || null,
      employeeNumber: idTokenPayload['custom:employeeNumber'] || null,
      firstName: idTokenPayload['custom:firstName'] || idTokenPayload.given_name || null,
      lastName: idTokenPayload['custom:lastName'] || idTokenPayload.family_name || null,
      nickName: idTokenPayload['custom:nickName'] || idTokenPayload.nickname || null,
      role: idTokenPayload['custom:role'] || 'employee',
      groups: idTokenPayload['cognito:groups'] || [],
      username: idTokenPayload['cognito:username']
    };

    return {
      success: true,
      user,
      accessToken: AccessToken,
      idToken: IdToken,
      expiresIn: ExpiresIn
    };

  } catch (error) {
    console.error('Cognito refresh error:', error);

    if (error.name === 'NotAuthorizedException') {
      return {
        success: false,
        error: 'Refresh token expired or invalid',
        code: 'TOKEN_EXPIRED'
      };
    }

    return {
      success: false,
      error: 'Token refresh failed',
      code: 'REFRESH_FAILED',
      details: error.message
    };
  }
}

/**
 * Sign out user from Cognito
 * Invalidates all tokens for the user
 *
 * @param {string} accessToken - Valid access token
 * @returns {Promise<Object>} Logout result
 */
async function handleCognitoLogout(accessToken) {
  try {
    if (!accessToken) {
      return {
        success: false,
        error: 'Access token is required',
        code: 'VALIDATION_ERROR'
      };
    }

    // Global sign out - invalidates all tokens
    const command = new GlobalSignOutCommand({
      AccessToken: accessToken
    });

    await cognitoClient.send(command);

    return {
      success: true,
      message: 'Successfully logged out'
    };

  } catch (error) {
    console.error('Cognito logout error:', error);

    if (error.name === 'NotAuthorizedException') {
      return {
        success: false,
        error: 'Invalid or expired access token',
        code: 'UNAUTHORIZED'
      };
    }

    return {
      success: false,
      error: 'Logout failed',
      code: 'LOGOUT_FAILED',
      details: error.message
    };
  }
}

/**
 * Verify and decode Cognito JWT token
 * Validates token signature, expiration, and audience
 *
 * @param {string} token - JWT token to verify (access or ID token)
 * @param {string} tokenType - Type of token: 'access' or 'id' (default: 'access')
 * @returns {Promise<Object>} Decoded token payload with user info
 */
async function verifyCognitoToken(token, tokenType = 'access') {
  try {
    if (!token) {
      return {
        success: false,
        error: 'Token is required',
        code: 'VALIDATION_ERROR'
      };
    }

    // Choose appropriate verifier based on token type
    const verifier = tokenType === 'id' ? idTokenVerifier : accessTokenVerifier;

    // Verify token (throws error if invalid)
    const payload = await verifier.verify(token);

    // For access tokens, we need to get user details separately
    if (tokenType === 'access') {
      // Get user attributes using access token
      const getUserCommand = new GetUserCommand({
        AccessToken: token
      });

      const userResponse = await cognitoClient.send(getUserCommand);

      // Convert attributes array to object
      const attributes = {};
      userResponse.UserAttributes.forEach(attr => {
        attributes[attr.Name] = attr.Value;
      });

      return {
        success: true,
        user: {
          userId: payload.sub,
          username: payload.username,
          email: attributes.email,
          emailVerified: attributes.email_verified === 'true',

          // Custom attributes
          personId: attributes['custom:personId'] || null,
          employeeNumber: attributes['custom:employeeNumber'] || null,
          firstName: attributes['custom:firstName'] || attributes.given_name || null,
          lastName: attributes['custom:lastName'] || attributes.family_name || null,
          nickName: attributes['custom:nickName'] || attributes.nickname || null,
          role: attributes['custom:role'] || 'employee',

          // Groups from token
          groups: payload['cognito:groups'] || [],

          // Token info
          tokenExpires: new Date(payload.exp * 1000).toISOString(),
          tokenIssued: new Date(payload.iat * 1000).toISOString()
        },
        payload
      };
    }

    // For ID tokens, all info is in the token
    return {
      success: true,
      user: {
        userId: payload.sub,
        email: payload.email,
        emailVerified: payload.email_verified || false,
        personId: payload['custom:personId'] || null,
        employeeNumber: payload['custom:employeeNumber'] || null,
        firstName: payload['custom:firstName'] || payload.given_name || null,
        lastName: payload['custom:lastName'] || payload.family_name || null,
        nickName: payload['custom:nickName'] || payload.nickname || null,
        role: payload['custom:role'] || 'employee',
        groups: payload['cognito:groups'] || [],
        username: payload['cognito:username'],
        tokenExpires: new Date(payload.exp * 1000).toISOString(),
        tokenIssued: new Date(payload.iat * 1000).toISOString()
      },
      payload
    };

  } catch (error) {
    console.error('Token verification error:', error);

    if (error.name === 'JwtExpiredError' || error.message?.includes('expired')) {
      return {
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      };
    }

    if (error.name === 'NotAuthorizedException') {
      return {
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      };
    }

    return {
      success: false,
      error: 'Token verification failed',
      code: 'VERIFICATION_FAILED',
      details: error.message
    };
  }
}

/**
 * Get current user information from access token
 *
 * @param {string} accessToken - Valid access token
 * @returns {Promise<Object>} User information
 */
async function getCurrentUser(accessToken) {
  try {
    const command = new GetUserCommand({
      AccessToken: accessToken
    });

    const response = await cognitoClient.send(command);

    // Convert attributes array to object
    const attributes = {};
    response.UserAttributes.forEach(attr => {
      attributes[attr.Name] = attr.Value;
    });

    return {
      success: true,
      user: {
        userId: attributes.sub,
        username: response.Username,
        email: attributes.email,
        emailVerified: attributes.email_verified === 'true',
        personId: attributes['custom:personId'] || null,
        employeeNumber: attributes['custom:employeeNumber'] || null,
        firstName: attributes['custom:firstName'] || attributes.given_name || null,
        lastName: attributes['custom:lastName'] || attributes.family_name || null,
        nickName: attributes['custom:nickName'] || attributes.nickname || null,
        role: attributes['custom:role'] || 'employee',
        phoneNumber: attributes.phone_number || null,
        phoneNumberVerified: attributes.phone_number_verified === 'true'
      }
    };

  } catch (error) {
    console.error('Get current user error:', error);

    if (error.name === 'NotAuthorizedException') {
      return {
        success: false,
        error: 'Invalid or expired access token',
        code: 'UNAUTHORIZED'
      };
    }

    return {
      success: false,
      error: 'Failed to get user information',
      code: 'INTERNAL_ERROR',
      details: error.message
    };
  }
}

module.exports = {
  handleCognitoLogin,
  handleCognitoRefresh,
  handleCognitoLogout,
  verifyCognitoToken,
  getCurrentUser,
  COGNITO_CONFIG
};
