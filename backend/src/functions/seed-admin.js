/**
 * Seed script to create initial SuperAdmin user
 * Run with: node seed-admin.js
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { PutCommand, DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

async function seedSuperAdmin() {
  // Initial password that must be changed on first login
  const initialPassword = 'SiteLogix2025!';
  const hashedPassword = await bcrypt.hash(initialPassword, 12);

  const superAdmin = {
    userId: uuidv4(),
    username: 'jayson.rivas',
    email: 'jayson@impact931.com',
    passwordHash: hashedPassword,
    role: 'superadmin',
    firstName: 'Jayson',
    lastName: 'Rivas',
    phone: '',
    status: 'active',
    permissions: ['*'], // All permissions
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLogin: null,
    mustChangePassword: true, // Force password change on first login
    failedLoginAttempts: 0
  };

  try {
    await docClient.send(new PutCommand({
      TableName: 'sitelogix-users',
      Item: superAdmin
    }));

    console.log('✅ SuperAdmin user created successfully!');
    console.log('');
    console.log('Login Credentials:');
    console.log('==================');
    console.log(`Username: ${superAdmin.username}`);
    console.log(`Password: ${initialPassword}`);
    console.log(`Email: ${superAdmin.email}`);
    console.log('');
    console.log('⚠️  You will be prompted to change your password on first login.');
    console.log('');
    console.log('User ID:', superAdmin.userId);

  } catch (error) {
    console.error('❌ Error creating SuperAdmin:', error);
    throw error;
  }
}

seedSuperAdmin()
  .then(() => {
    console.log('✅ Seeding complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });
