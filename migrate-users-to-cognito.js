/**
 * SiteLogix User Migration Script
 *
 * Migrates users from DynamoDB (sitelogix-personnel) to AWS Cognito
 *
 * Features:
 * - Scans all active personnel records
 * - Creates Cognito users with appropriate attributes
 * - Sets temporary password requiring change on first login
 * - Assigns users to role-based Cognito groups
 * - Updates DynamoDB with cognitoUserId
 * - Comprehensive error handling and reporting
 * - Dry-run mode for testing
 *
 * Usage:
 *   node migrate-users-to-cognito.js           # Run migration
 *   node migrate-users-to-cognito.js --dry-run # Test without making changes
 */

require('dotenv').config();
const {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
  AdminSetUserPasswordCommand
} = require('@aws-sdk/client-cognito-identity-provider');
const { DynamoDBClient, ScanCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const fs = require('fs');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  cognito: {
    userPoolId: process.env.AWS_COGNITO_USER_POOL_ID || 'us-east-1_tPkj4vb3A',
    clientId: process.env.AWS_COGNITO_CLIENT_ID || '7rsb6cnpp86cdgtv3h9j6c8t75',
    region: process.env.AWS_COGNITO_REGION || 'us-east-1',
  },
  dynamodb: {
    tableName: 'sitelogix-personnel',
    region: process.env.AWS_REGION || 'us-east-1',
  },
  tempPassword: 'ChangeMe2025!',
  validRoles: ['Admin', 'Manager', 'Foreman', 'Employee', 'SuperAdmin'],
};

// AWS Clients
const cognitoClient = new CognitoIdentityProviderClient({
  region: CONFIG.cognito.region
});

const dynamoClient = new DynamoDBClient({
  region: CONFIG.dynamodb.region
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Validate email format
 */
function isValidEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Format phone number for Cognito (E.164 format)
 */
function formatPhoneNumber(phone) {
  if (!phone) return null;

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // Must be 10 or 11 digits
  if (digits.length === 10) {
    return `+1${digits}`; // US number
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  return null; // Invalid format
}

/**
 * Normalize role name to match Cognito group names
 */
function normalizeRole(role) {
  if (!role) return 'Employee';

  const normalized = role.toLowerCase();

  // Map variations to standard roles
  const roleMap = {
    'admin': 'Admin',
    'administrator': 'Admin',
    'manager': 'Manager',
    'foreman': 'Foreman',
    'employee': 'Employee',
    'worker': 'Employee',
    'superadmin': 'SuperAdmin',
    'super admin': 'SuperAdmin',
  };

  return roleMap[normalized] || 'Employee';
}

/**
 * Color console output
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function colorLog(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// ============================================================================
// COGNITO OPERATIONS
// ============================================================================

/**
 * Create user in Cognito
 */
async function createCognitoUser(personnel, dryRun = false) {
  const { email, firstName, lastName, phone, personId, employeeNumber, preferredName, role, jobTitle, employmentStatus } = personnel;

  if (dryRun) {
    colorLog(`  [DRY RUN] Would create Cognito user: ${email}`, 'cyan');
    return { sub: `DRYRUN-${personId}` };
  }

  // Prepare user attributes
  const userAttributes = [
    { Name: 'email', Value: email },
    { Name: 'email_verified', Value: 'true' },
    { Name: 'given_name', Value: firstName || 'Unknown' },
    { Name: 'family_name', Value: lastName || 'Unknown' },
    { Name: 'custom:personId', Value: personId },
    { Name: 'custom:employeeNumber', Value: employeeNumber || '' },
    { Name: 'custom:nickName', Value: preferredName || firstName || '' },
    { Name: 'custom:role', Value: normalizeRole(role) },
    { Name: 'custom:employmentStatus', Value: employmentStatus || 'active' },
  ];

  // Add phone if valid
  const formattedPhone = formatPhoneNumber(phone);
  if (formattedPhone) {
    userAttributes.push({ Name: 'phone_number', Value: formattedPhone });
    userAttributes.push({ Name: 'phone_number_verified', Value: 'true' });
  }

  // Add job title if available
  if (jobTitle) {
    userAttributes.push({ Name: 'custom:jobTitle', Value: jobTitle });
  }

  try {
    // Create user
    const createCommand = new AdminCreateUserCommand({
      UserPoolId: CONFIG.cognito.userPoolId,
      Username: email,
      UserAttributes: userAttributes,
      TemporaryPassword: CONFIG.tempPassword,
      MessageAction: 'SUPPRESS', // Don't send invitation email (we'll handle this separately)
      DesiredDeliveryMediums: ['EMAIL'],
    });

    const response = await cognitoClient.send(createCommand);

    // Extract Cognito sub (user ID)
    const cognitoUserId = response.User?.Attributes?.find(attr => attr.Name === 'sub')?.Value;

    if (!cognitoUserId) {
      throw new Error('Failed to retrieve Cognito user ID');
    }

    // Set permanent password (still requires change on first login)
    const setPasswordCommand = new AdminSetUserPasswordCommand({
      UserPoolId: CONFIG.cognito.userPoolId,
      Username: email,
      Password: CONFIG.tempPassword,
      Permanent: false, // User must change password on first login
    });

    await cognitoClient.send(setPasswordCommand);

    // Add user to role-based group
    const userRole = normalizeRole(role);
    if (CONFIG.validRoles.includes(userRole)) {
      try {
        const addToGroupCommand = new AdminAddUserToGroupCommand({
          UserPoolId: CONFIG.cognito.userPoolId,
          Username: email,
          GroupName: userRole,
        });

        await cognitoClient.send(addToGroupCommand);
        colorLog(`    ✓ Added to group: ${userRole}`, 'green');
      } catch (groupError) {
        colorLog(`    ⚠ Warning: Could not add to group ${userRole}: ${groupError.message}`, 'yellow');
      }
    }

    return { sub: cognitoUserId };

  } catch (error) {
    if (error.name === 'UsernameExistsException') {
      throw new Error(`User already exists: ${email}`);
    }
    throw error;
  }
}

/**
 * Update DynamoDB personnel record with cognitoUserId
 */
async function updatePersonnelWithCognitoId(personId, cognitoUserId, dryRun = false) {
  if (dryRun) {
    colorLog(`  [DRY RUN] Would update DynamoDB record ${personId} with cognitoUserId`, 'cyan');
    return;
  }

  try {
    await dynamoClient.send(new UpdateItemCommand({
      TableName: CONFIG.dynamodb.tableName,
      Key: marshall({
        PK: personId,
        SK: 'PROFILE',
      }),
      UpdateExpression: 'SET cognitoUserId = :cognitoUserId, updatedAt = :updatedAt',
      ExpressionAttributeValues: marshall({
        ':cognitoUserId': cognitoUserId,
        ':updatedAt': new Date().toISOString(),
      }),
    }));

    colorLog(`    ✓ Updated DynamoDB with cognitoUserId`, 'green');
  } catch (error) {
    throw new Error(`Failed to update DynamoDB: ${error.message}`);
  }
}

// ============================================================================
// MAIN MIGRATION LOGIC
// ============================================================================

/**
 * Scan all personnel from DynamoDB
 */
async function getAllPersonnel() {
  colorLog('\n📋 Scanning sitelogix-personnel table...', 'blue');

  const personnel = [];
  let lastEvaluatedKey = null;

  do {
    const params = {
      TableName: CONFIG.dynamodb.tableName,
      FilterExpression: 'SK = :profile AND attribute_exists(email)',
      ExpressionAttributeValues: marshall({
        ':profile': 'PROFILE',
      }),
    };

    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }

    const result = await dynamoClient.send(new ScanCommand(params));

    if (result.Items) {
      const items = result.Items.map(item => unmarshall(item));
      personnel.push(...items);
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  colorLog(`✓ Found ${personnel.length} personnel records with email addresses`, 'green');

  return personnel;
}

/**
 * Migrate a single user
 */
async function migrateUser(personnel, dryRun = false) {
  const { email, firstName, lastName, personId, employeeNumber } = personnel;
  const displayName = `${firstName || 'Unknown'} ${lastName || 'Unknown'}`;

  try {
    colorLog(`\n→ Migrating: ${displayName} (${email})`, 'bright');

    // Validate email
    if (!isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    // Create Cognito user
    const cognitoUser = await createCognitoUser(personnel, dryRun);
    colorLog(`  ✓ Cognito user created: ${cognitoUser.sub}`, 'green');

    // Update DynamoDB
    await updatePersonnelWithCognitoId(personId, cognitoUser.sub, dryRun);

    return {
      success: true,
      email,
      displayName,
      personId,
      employeeNumber,
      cognitoUserId: cognitoUser.sub,
    };

  } catch (error) {
    colorLog(`  ✗ Failed: ${error.message}`, 'red');

    return {
      success: false,
      email,
      displayName,
      personId,
      employeeNumber,
      error: error.message,
    };
  }
}

/**
 * Generate migration report
 */
function generateReport(results, dryRun = false) {
  const report = {
    timestamp: new Date().toISOString(),
    dryRun,
    summary: {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    },
    results,
  };

  const filename = `migration-report-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(report, null, 2));

  colorLog(`\n📄 Report saved: ${filename}`, 'cyan');

  return report;
}

/**
 * Display summary
 */
function displaySummary(report) {
  const { summary, results } = report;

  console.log('\n' + '='.repeat(70));
  colorLog('📊 MIGRATION SUMMARY', 'bright');
  console.log('='.repeat(70));

  colorLog(`\nTotal Users:       ${summary.total}`, 'blue');
  colorLog(`✓ Successful:      ${summary.successful}`, 'green');
  colorLog(`✗ Failed:          ${summary.failed}`, 'red');

  if (summary.failed > 0) {
    colorLog('\n❌ Failed Migrations:', 'red');
    results
      .filter(r => !r.success)
      .forEach(r => {
        colorLog(`  • ${r.displayName} (${r.email})`, 'yellow');
        colorLog(`    Reason: ${r.error}`, 'red');
      });
  }

  if (report.dryRun) {
    colorLog('\n🔍 DRY RUN MODE - No changes were made', 'yellow');
    colorLog('Run without --dry-run flag to perform actual migration', 'yellow');
  }

  console.log('\n' + '='.repeat(70) + '\n');
}

/**
 * Main migration function
 */
async function migrate() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('\n' + '='.repeat(70));
  colorLog('🚀 SiteLogix User Migration to Cognito', 'bright');
  console.log('='.repeat(70));

  if (dryRun) {
    colorLog('\n🔍 DRY RUN MODE - No changes will be made\n', 'yellow');
  }

  colorLog('Configuration:', 'blue');
  console.log(`  User Pool ID:      ${CONFIG.cognito.userPoolId}`);
  console.log(`  Region:            ${CONFIG.cognito.region}`);
  console.log(`  DynamoDB Table:    ${CONFIG.dynamodb.tableName}`);
  console.log(`  Temp Password:     ${CONFIG.tempPassword}`);

  try {
    // Get all personnel
    const allPersonnel = await getAllPersonnel();

    if (allPersonnel.length === 0) {
      colorLog('\n⚠ No personnel records found with email addresses', 'yellow');
      return;
    }

    // Filter active users with valid emails
    const usersToMigrate = allPersonnel.filter(p => {
      const isActive = p.employmentStatus === 'active' || !p.employmentStatus;
      const hasEmail = isValidEmail(p.email);
      const notAlreadyMigrated = !p.cognitoUserId;

      return isActive && hasEmail && notAlreadyMigrated;
    });

    colorLog(`\n📊 Found ${usersToMigrate.length} users to migrate (active, with email, not already migrated)`, 'blue');

    const skipped = allPersonnel.length - usersToMigrate.length;
    if (skipped > 0) {
      colorLog(`⊘ Skipping ${skipped} users (inactive, no email, or already migrated)`, 'yellow');
    }

    // Confirm before proceeding (unless dry-run)
    if (!dryRun && usersToMigrate.length > 0) {
      colorLog('\n⚠ WARNING: This will create users in Cognito and update DynamoDB records', 'yellow');
      colorLog('Press Ctrl+C to cancel, or wait 5 seconds to continue...', 'yellow');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Migrate each user
    colorLog('\n🔄 Starting migration...', 'blue');
    const results = [];

    for (let i = 0; i < usersToMigrate.length; i++) {
      const personnel = usersToMigrate[i];
      colorLog(`\n[${i + 1}/${usersToMigrate.length}]`, 'cyan');

      const result = await migrateUser(personnel, dryRun);
      results.push(result);

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Generate and display report
    const report = generateReport(results, dryRun);
    displaySummary(report);

    // Exit with appropriate code
    process.exit(report.summary.failed > 0 ? 1 : 0);

  } catch (error) {
    colorLog(`\n❌ Migration failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// ============================================================================
// EXECUTION
// ============================================================================

// Run migration
migrate().catch(error => {
  colorLog(`\n💥 Unexpected error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
