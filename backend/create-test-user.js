const bcrypt = require('bcryptjs');
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall } = require('@aws-sdk/util-dynamodb');
const { v4: uuidv4 } = require('uuid');

async function createUser() {
  const passwordHash = await bcrypt.hash('SiteLogix2025!', 12);
  const userId = uuidv4();
  const timestamp = new Date().toISOString();

  const user = {
    userId,
    username: 'JaysonR',
    email: 'jayson@jhr-photography.com',
    passwordHash,
    role: 'superadmin',
    firstName: 'Jayson',
    lastName: 'Rivas',
    phone: '',
    status: 'active',
    permissions: ['*'],
    createdAt: timestamp,
    updatedAt: timestamp,
    lastLogin: null,
    mustChangePassword: false,
    failedLoginAttempts: 0
  };

  const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
  const putCommand = new PutItemCommand({
    TableName: 'sitelogix-users',
    Item: marshall(user)
  });

  await dynamoClient.send(putCommand);
  console.log('User created successfully:', JSON.stringify({ userId, username: user.username, email: user.email, role: user.role }, null, 2));
}

createUser().catch(console.error);
