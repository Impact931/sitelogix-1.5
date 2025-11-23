/**
 * AWS Cognito User Management Module
 *
 * Handles user CRUD operations in AWS Cognito User Pool
 * - Create new users (admin operation)
 * - Update user attributes
 * - Add users to groups (role management)
 * - Password reset and change
 * - Enable/disable users
 *
 * @module cognito-user-management
 */

const {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  AdminGetUserCommand,
  AdminDeleteUserCommand,
  AdminEnableUserCommand,
  AdminDisableUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminListGroupsForUserCommand,
  ListUsersCommand,
  ChangePasswordCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  AdminResetUserPasswordCommand
} = require('@aws-sdk/client-cognito-identity-provider');
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

/**
 * Generate SECRET_HASH for Cognito operations
 */
function generateSecretHash(username) {
  const message = username + COGNITO_CONFIG.clientId;
  const hmac = crypto.createHmac('sha256', COGNITO_CONFIG.clientSecret);
  hmac.update(message);
  return hmac.digest('base64');
}

/**
 * Create a new user in Cognito User Pool (Admin operation)
 *
 * @param {Object} userData - User information
 * @param {string} userData.email - User email (required, used as username)
 * @param {string} userData.password - Temporary password (optional, will be auto-generated if not provided)
 * @param {string} userData.firstName - First name
 * @param {string} userData.lastName - Last name
 * @param {string} userData.personId - Link to DynamoDB personnel record
 * @param {string} userData.employeeNumber - Employee number
 * @param {string} userData.nickName - Preferred name
 * @param {string} userData.role - User role (employee, manager, admin)
 * @param {string} userData.phoneNumber - Phone number (optional)
 * @param {boolean} userData.emailVerified - Set email as verified (default: true)
 * @param {boolean} userData.sendEmail - Send welcome email with temp password (default: false)
 * @returns {Promise<Object>} Created user info
 */
async function createCognitoUser(userData) {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      personId,
      employeeNumber,
      nickName,
      role = 'employee',
      phoneNumber,
      emailVerified = true,
      sendEmail = false
    } = userData;

    // Validation
    if (!email) {
      return {
        success: false,
        error: 'Email is required',
        code: 'VALIDATION_ERROR'
      };
    }

    if (!firstName || !lastName) {
      return {
        success: false,
        error: 'First name and last name are required',
        code: 'VALIDATION_ERROR'
      };
    }

    // Build user attributes
    const userAttributes = [
      { Name: 'email', Value: email },
      { Name: 'email_verified', Value: emailVerified ? 'true' : 'false' }
    ];

    // Add standard attributes
    if (firstName) userAttributes.push({ Name: 'given_name', Value: firstName });
    if (lastName) userAttributes.push({ Name: 'family_name', Value: lastName });
    if (nickName) userAttributes.push({ Name: 'nickname', Value: nickName });
    if (phoneNumber) userAttributes.push({ Name: 'phone_number', Value: phoneNumber });

    // Add custom attributes (must be defined in User Pool schema)
    if (personId) userAttributes.push({ Name: 'custom:personId', Value: personId });
    if (employeeNumber) userAttributes.push({ Name: 'custom:employeeNumber', Value: employeeNumber });
    if (firstName) userAttributes.push({ Name: 'custom:firstName', Value: firstName });
    if (lastName) userAttributes.push({ Name: 'custom:lastName', Value: lastName });
    if (nickName) userAttributes.push({ Name: 'custom:nickName', Value: nickName });
    if (role) userAttributes.push({ Name: 'custom:role', Value: role });

    // Create user command
    const createCommand = new AdminCreateUserCommand({
      UserPoolId: COGNITO_CONFIG.userPoolId,
      Username: email, // Use email as username
      UserAttributes: userAttributes,
      TemporaryPassword: password, // If not provided, Cognito generates one
      MessageAction: sendEmail ? 'RESEND' : 'SUPPRESS', // Don't send email by default
      DesiredDeliveryMediums: sendEmail ? ['EMAIL'] : []
    });

    const createResponse = await cognitoClient.send(createCommand);

    // If password provided and not sending email, set it as permanent
    if (password && !sendEmail) {
      const setPasswordCommand = new AdminSetUserPasswordCommand({
        UserPoolId: COGNITO_CONFIG.userPoolId,
        Username: email,
        Password: password,
        Permanent: true
      });

      await cognitoClient.send(setPasswordCommand);
    }

    // Add user to role group if specified
    if (role) {
      try {
        await addUserToGroup(email, role);
      } catch (groupError) {
        console.warn(`Could not add user to group ${role}:`, groupError.message);
        // Don't fail user creation if group assignment fails
      }
    }

    return {
      success: true,
      user: {
        userId: createResponse.User.Username,
        email,
        firstName,
        lastName,
        nickName,
        personId,
        employeeNumber,
        role,
        status: createResponse.User.UserStatus,
        enabled: createResponse.User.Enabled,
        createdAt: createResponse.User.UserCreateDate?.toISOString()
      },
      temporaryPassword: !password ? 'Generated by Cognito - check email' : undefined
    };

  } catch (error) {
    console.error('Create Cognito user error:', error);

    if (error.name === 'UsernameExistsException') {
      return {
        success: false,
        error: 'User with this email already exists',
        code: 'USER_EXISTS'
      };
    }

    if (error.name === 'InvalidPasswordException') {
      return {
        success: false,
        error: 'Password does not meet requirements',
        code: 'INVALID_PASSWORD',
        details: error.message
      };
    }

    if (error.name === 'InvalidParameterException') {
      return {
        success: false,
        error: 'Invalid user parameters',
        code: 'INVALID_PARAMETERS',
        details: error.message
      };
    }

    return {
      success: false,
      error: 'Failed to create user',
      code: 'INTERNAL_ERROR',
      details: error.message
    };
  }
}

/**
 * Update user attributes in Cognito
 *
 * @param {string} userId - Cognito username (email)
 * @param {Object} updates - Attributes to update
 * @returns {Promise<Object>} Update result
 */
async function updateCognitoUser(userId, updates) {
  try {
    if (!userId) {
      return {
        success: false,
        error: 'User ID is required',
        code: 'VALIDATION_ERROR'
      };
    }

    // Build attributes array
    const userAttributes = [];

    // Map common attributes
    const attributeMap = {
      email: 'email',
      firstName: 'given_name',
      lastName: 'family_name',
      nickName: 'nickname',
      phoneNumber: 'phone_number'
    };

    // Add standard attributes
    Object.keys(attributeMap).forEach(key => {
      if (updates[key] !== undefined) {
        userAttributes.push({
          Name: attributeMap[key],
          Value: updates[key]
        });
      }
    });

    // Add custom attributes
    const customAttributes = ['personId', 'employeeNumber', 'firstName', 'lastName', 'nickName', 'role'];
    customAttributes.forEach(attr => {
      if (updates[attr] !== undefined) {
        userAttributes.push({
          Name: `custom:${attr}`,
          Value: updates[attr]
        });
      }
    });

    // Handle email verification status
    if (updates.emailVerified !== undefined) {
      userAttributes.push({
        Name: 'email_verified',
        Value: updates.emailVerified ? 'true' : 'false'
      });
    }

    if (userAttributes.length === 0) {
      return {
        success: false,
        error: 'No attributes to update',
        code: 'VALIDATION_ERROR'
      };
    }

    const command = new AdminUpdateUserAttributesCommand({
      UserPoolId: COGNITO_CONFIG.userPoolId,
      Username: userId,
      UserAttributes: userAttributes
    });

    await cognitoClient.send(command);

    return {
      success: true,
      message: 'User attributes updated successfully',
      userId
    };

  } catch (error) {
    console.error('Update Cognito user error:', error);

    if (error.name === 'UserNotFoundException') {
      return {
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      };
    }

    return {
      success: false,
      error: 'Failed to update user',
      code: 'INTERNAL_ERROR',
      details: error.message
    };
  }
}

/**
 * Add user to a Cognito group (for role-based access control)
 *
 * @param {string} userId - Cognito username (email)
 * @param {string} groupName - Group name (e.g., 'admin', 'manager', 'employee')
 * @returns {Promise<Object>} Result
 */
async function addUserToGroup(userId, groupName) {
  try {
    if (!userId || !groupName) {
      return {
        success: false,
        error: 'User ID and group name are required',
        code: 'VALIDATION_ERROR'
      };
    }

    const command = new AdminAddUserToGroupCommand({
      UserPoolId: COGNITO_CONFIG.userPoolId,
      Username: userId,
      GroupName: groupName
    });

    await cognitoClient.send(command);

    return {
      success: true,
      message: `User added to group ${groupName}`,
      userId,
      groupName
    };

  } catch (error) {
    console.error('Add user to group error:', error);

    if (error.name === 'UserNotFoundException') {
      return {
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      };
    }

    if (error.name === 'ResourceNotFoundException') {
      return {
        success: false,
        error: `Group ${groupName} does not exist`,
        code: 'GROUP_NOT_FOUND'
      };
    }

    return {
      success: false,
      error: 'Failed to add user to group',
      code: 'INTERNAL_ERROR',
      details: error.message
    };
  }
}

/**
 * Remove user from a Cognito group
 *
 * @param {string} userId - Cognito username (email)
 * @param {string} groupName - Group name
 * @returns {Promise<Object>} Result
 */
async function removeUserFromGroup(userId, groupName) {
  try {
    const command = new AdminRemoveUserFromGroupCommand({
      UserPoolId: COGNITO_CONFIG.userPoolId,
      Username: userId,
      GroupName: groupName
    });

    await cognitoClient.send(command);

    return {
      success: true,
      message: `User removed from group ${groupName}`,
      userId,
      groupName
    };

  } catch (error) {
    console.error('Remove user from group error:', error);

    if (error.name === 'UserNotFoundException') {
      return {
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      };
    }

    return {
      success: false,
      error: 'Failed to remove user from group',
      code: 'INTERNAL_ERROR',
      details: error.message
    };
  }
}

/**
 * Trigger password reset for a user (sends reset email)
 *
 * @param {string} email - User's email address
 * @returns {Promise<Object>} Result
 */
async function resetPassword(email) {
  try {
    if (!email) {
      return {
        success: false,
        error: 'Email is required',
        code: 'VALIDATION_ERROR'
      };
    }

    // Admin reset - generates temp password and sends email
    const command = new AdminResetUserPasswordCommand({
      UserPoolId: COGNITO_CONFIG.userPoolId,
      Username: email
    });

    await cognitoClient.send(command);

    return {
      success: true,
      message: 'Password reset email sent. User must check their email for temporary password.',
      email
    };

  } catch (error) {
    console.error('Reset password error:', error);

    if (error.name === 'UserNotFoundException') {
      return {
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      };
    }

    if (error.name === 'InvalidParameterException') {
      return {
        success: false,
        error: 'Invalid email format',
        code: 'INVALID_PARAMETER'
      };
    }

    if (error.name === 'LimitExceededException') {
      return {
        success: false,
        error: 'Too many password reset attempts. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      };
    }

    return {
      success: false,
      error: 'Failed to reset password',
      code: 'INTERNAL_ERROR',
      details: error.message
    };
  }
}

/**
 * Change user's password (requires current password)
 *
 * @param {string} accessToken - User's valid access token
 * @param {string} oldPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<Object>} Result
 */
async function changePassword(accessToken, oldPassword, newPassword) {
  try {
    if (!accessToken || !oldPassword || !newPassword) {
      return {
        success: false,
        error: 'Access token, old password, and new password are required',
        code: 'VALIDATION_ERROR'
      };
    }

    if (newPassword.length < 8) {
      return {
        success: false,
        error: 'New password must be at least 8 characters',
        code: 'INVALID_PASSWORD'
      };
    }

    const command = new ChangePasswordCommand({
      AccessToken: accessToken,
      PreviousPassword: oldPassword,
      ProposedPassword: newPassword
    });

    await cognitoClient.send(command);

    return {
      success: true,
      message: 'Password changed successfully'
    };

  } catch (error) {
    console.error('Change password error:', error);

    if (error.name === 'NotAuthorizedException') {
      return {
        success: false,
        error: 'Current password is incorrect',
        code: 'INVALID_PASSWORD'
      };
    }

    if (error.name === 'InvalidPasswordException') {
      return {
        success: false,
        error: 'New password does not meet requirements',
        code: 'INVALID_PASSWORD',
        details: error.message
      };
    }

    if (error.name === 'LimitExceededException') {
      return {
        success: false,
        error: 'Too many password change attempts. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      };
    }

    return {
      success: false,
      error: 'Failed to change password',
      code: 'INTERNAL_ERROR',
      details: error.message
    };
  }
}

/**
 * Get user information from Cognito
 *
 * @param {string} userId - Cognito username (email)
 * @returns {Promise<Object>} User information
 */
async function getCognitoUser(userId) {
  try {
    const command = new AdminGetUserCommand({
      UserPoolId: COGNITO_CONFIG.userPoolId,
      Username: userId
    });

    const response = await cognitoClient.send(command);

    // Convert attributes array to object
    const attributes = {};
    response.UserAttributes.forEach(attr => {
      attributes[attr.Name] = attr.Value;
    });

    // Get user's groups
    const groupsCommand = new AdminListGroupsForUserCommand({
      UserPoolId: COGNITO_CONFIG.userPoolId,
      Username: userId
    });

    const groupsResponse = await cognitoClient.send(groupsCommand);
    const groups = groupsResponse.Groups?.map(g => g.GroupName) || [];

    return {
      success: true,
      user: {
        userId: response.Username,
        email: attributes.email,
        emailVerified: attributes.email_verified === 'true',
        firstName: attributes['custom:firstName'] || attributes.given_name,
        lastName: attributes['custom:lastName'] || attributes.family_name,
        nickName: attributes['custom:nickName'] || attributes.nickname,
        personId: attributes['custom:personId'],
        employeeNumber: attributes['custom:employeeNumber'],
        role: attributes['custom:role'],
        phoneNumber: attributes.phone_number,
        status: response.UserStatus,
        enabled: response.Enabled,
        groups,
        createdAt: response.UserCreateDate?.toISOString(),
        modifiedAt: response.UserLastModifiedDate?.toISOString()
      }
    };

  } catch (error) {
    console.error('Get Cognito user error:', error);

    if (error.name === 'UserNotFoundException') {
      return {
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
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

/**
 * Enable a disabled user account
 *
 * @param {string} userId - Cognito username (email)
 * @returns {Promise<Object>} Result
 */
async function enableUser(userId) {
  try {
    const command = new AdminEnableUserCommand({
      UserPoolId: COGNITO_CONFIG.userPoolId,
      Username: userId
    });

    await cognitoClient.send(command);

    return {
      success: true,
      message: 'User enabled successfully',
      userId
    };

  } catch (error) {
    console.error('Enable user error:', error);

    if (error.name === 'UserNotFoundException') {
      return {
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      };
    }

    return {
      success: false,
      error: 'Failed to enable user',
      code: 'INTERNAL_ERROR',
      details: error.message
    };
  }
}

/**
 * Disable a user account (prevents login)
 *
 * @param {string} userId - Cognito username (email)
 * @returns {Promise<Object>} Result
 */
async function disableUser(userId) {
  try {
    const command = new AdminDisableUserCommand({
      UserPoolId: COGNITO_CONFIG.userPoolId,
      Username: userId
    });

    await cognitoClient.send(command);

    return {
      success: true,
      message: 'User disabled successfully',
      userId
    };

  } catch (error) {
    console.error('Disable user error:', error);

    if (error.name === 'UserNotFoundException') {
      return {
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      };
    }

    return {
      success: false,
      error: 'Failed to disable user',
      code: 'INTERNAL_ERROR',
      details: error.message
    };
  }
}

/**
 * Delete a user permanently from Cognito
 *
 * @param {string} userId - Cognito username (email)
 * @returns {Promise<Object>} Result
 */
async function deleteCognitoUser(userId) {
  try {
    const command = new AdminDeleteUserCommand({
      UserPoolId: COGNITO_CONFIG.userPoolId,
      Username: userId
    });

    await cognitoClient.send(command);

    return {
      success: true,
      message: 'User deleted permanently',
      userId
    };

  } catch (error) {
    console.error('Delete user error:', error);

    if (error.name === 'UserNotFoundException') {
      return {
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      };
    }

    return {
      success: false,
      error: 'Failed to delete user',
      code: 'INTERNAL_ERROR',
      details: error.message
    };
  }
}

/**
 * List all users in the user pool
 *
 * @param {Object} options - List options
 * @param {number} options.limit - Max number of users to return (default: 60)
 * @param {string} options.paginationToken - Token for next page
 * @returns {Promise<Object>} List of users
 */
async function listCognitoUsers(options = {}) {
  try {
    const { limit = 60, paginationToken } = options;

    const command = new ListUsersCommand({
      UserPoolId: COGNITO_CONFIG.userPoolId,
      Limit: limit,
      PaginationToken: paginationToken
    });

    const response = await cognitoClient.send(command);

    const users = response.Users.map(user => {
      const attributes = {};
      user.Attributes.forEach(attr => {
        attributes[attr.Name] = attr.Value;
      });

      return {
        userId: user.Username,
        email: attributes.email,
        emailVerified: attributes.email_verified === 'true',
        firstName: attributes['custom:firstName'] || attributes.given_name,
        lastName: attributes['custom:lastName'] || attributes.family_name,
        nickName: attributes['custom:nickName'] || attributes.nickname,
        personId: attributes['custom:personId'],
        employeeNumber: attributes['custom:employeeNumber'],
        role: attributes['custom:role'],
        status: user.UserStatus,
        enabled: user.Enabled,
        createdAt: user.UserCreateDate?.toISOString(),
        modifiedAt: user.UserLastModifiedDate?.toISOString()
      };
    });

    return {
      success: true,
      users,
      paginationToken: response.PaginationToken,
      hasMore: !!response.PaginationToken
    };

  } catch (error) {
    console.error('List users error:', error);

    return {
      success: false,
      error: 'Failed to list users',
      code: 'INTERNAL_ERROR',
      details: error.message
    };
  }
}

module.exports = {
  createCognitoUser,
  updateCognitoUser,
  addUserToGroup,
  removeUserFromGroup,
  resetPassword,
  changePassword,
  getCognitoUser,
  enableUser,
  disableUser,
  deleteCognitoUser,
  listCognitoUsers,
  COGNITO_CONFIG
};
