/**
 * Seed Hardcoded Admin Accounts
 *
 * This script:
 * 1. Clears all existing users and personnel
 * 2. Creates 4 hardcoded admin accounts
 */

const { DynamoDBClient, ScanCommand, DeleteItemCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const bcrypt = require('bcryptjs');

const dynamodb = new DynamoDBClient({ region: 'us-east-1' });

// 4 Hardcoded Admins
const ADMINS = [
  {
    employeeNumber: 'N01',
    firstName: 'Aaron',
    lastName: 'Trask',
    nickname: 'Aaron',
    email: 'atrask@parkwaycs.com',
    password: 'ATrask123$',
    role: 'admin'
  },
  {
    employeeNumber: 'N02',
    firstName: 'Corey',
    lastName: 'Birchfield',
    nickname: 'Corey',
    email: 'corey.birchfield@parkwaycs.com',
    password: 'CBirch123$',
    role: 'admin'
  },
  {
    employeeNumber: 'PKW01',
    firstName: 'Robert',
    lastName: 'Trask',
    nickname: 'Robert',
    email: 'rtrask@parkwaycs.com',
    password: 'RTrask123$',
    role: 'admin'
  },
  {
    employeeNumber: 'IC101',
    firstName: 'Jayson',
    lastName: 'Rivas',
    nickname: 'Jayson',
    email: 'jayson@impactconsulting931.com',
    password: 'SiteLogix123$',
    role: 'admin'
  }
];

/**
 * Clear all records from a table
 */
async function clearTable(tableName, keyNames) {
  console.log(`\n🗑️  Clearing ${tableName}...`);

  try {
    const scanResult = await dynamodb.send(new ScanCommand({ TableName: tableName }));
    const items = scanResult.Items || [];

    console.log(`   Found ${items.length} items to delete`);

    for (const item of items) {
      const unmarshalled = unmarshall(item);
      const key = {};

      keyNames.forEach(keyName => {
        key[keyName] = unmarshalled[keyName];
      });

      await dynamodb.send(new DeleteItemCommand({
        TableName: tableName,
        Key: marshall(key)
      }));
    }

    console.log(`   ✅ Cleared ${items.length} items from ${tableName}`);
  } catch (error) {
    console.error(`   ❌ Error clearing ${tableName}:`, error.message);
    throw error;
  }
}

/**
 * Create admin in personnel table
 */
async function createAdmin(admin) {
  const passwordHash = await bcrypt.hash(admin.password, 10);
  const personId = `PER#${admin.employeeNumber}`;
  const now = new Date().toISOString();

  const personnelRecord = {
    PK: personId,
    SK: 'PROFILE',
    personId: personId,
    employeeNumber: admin.employeeNumber,
    firstName: admin.firstName,
    lastName: admin.lastName,
    fullName: `${admin.firstName} ${admin.lastName}`,
    preferredName: admin.nickname,
    email: admin.email,

    // Authentication fields
    username: admin.email,
    passwordHash: passwordHash,
    role: admin.role,

    // Status
    employmentStatus: 'active',
    needsProfileCompletion: false,

    // Metadata
    createdAt: now,
    updatedAt: now,
    createdBy: 'SYSTEM_SEED'
  };

  await dynamodb.send(new PutItemCommand({
    TableName: 'sitelogix-personnel',
    Item: marshall(personnelRecord, { removeUndefinedValues: true })
  }));

  console.log(`   ✅ Created admin: ${admin.firstName} ${admin.lastName} (${admin.employeeNumber})`);
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting Admin Seeding Process\n');
  console.log('=' .repeat(60));

  try {
    // Step 1: Clear existing data
    console.log('\n📋 STEP 1: Clearing existing data');
    await clearTable('sitelogix-users', ['userId']);
    await clearTable('sitelogix-personnel', ['PK', 'SK']);

    // Step 2: Create hardcoded admins
    console.log('\n📋 STEP 2: Creating hardcoded admins');
    console.log(`   Creating ${ADMINS.length} admin accounts...\n`);

    for (const admin of ADMINS) {
      await createAdmin(admin);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Admin seeding completed successfully!\n');
    console.log('Admin Accounts Created:');
    ADMINS.forEach(admin => {
      console.log(`   • ${admin.firstName} ${admin.lastName} - ${admin.email} (${admin.employeeNumber})`);
    });
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  }
}

main();
