#!/usr/bin/env node

/**
 * Clear Database Script
 * Deletes all items from all SiteLogix DynamoDB tables
 * WARNING: This is irreversible!
 */

const { DynamoDBClient, ScanCommand, DeleteItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });

const TABLES = [
  'sitelogix-reports',
  'sitelogix-personnel',
  'sitelogix-vendors',
  'sitelogix-constraints',
  'sitelogix-work-logs',
  'sitelogix-ai-analysis',
  'sitelogix-audit-log'
];

async function clearTable(tableName) {
  console.log(`\n🗑️  Clearing table: ${tableName}`);

  let deletedCount = 0;
  let lastEvaluatedKey = null;

  do {
    // Scan the table
    const scanCommand = new ScanCommand({
      TableName: tableName,
      ExclusiveStartKey: lastEvaluatedKey,
      Limit: 25 // Process in batches
    });

    const scanResult = await dynamoClient.send(scanCommand);

    if (!scanResult.Items || scanResult.Items.length === 0) {
      console.log(`   ✅ Table ${tableName} is empty`);
      break;
    }

    // Delete each item
    for (const item of scanResult.Items) {
      const unmarshalledItem = unmarshall(item);

      // Extract PK and SK for deletion
      const key = {
        PK: item.PK,
        SK: item.SK
      };

      const deleteCommand = new DeleteItemCommand({
        TableName: tableName,
        Key: key
      });

      await dynamoClient.send(deleteCommand);
      deletedCount++;

      if (deletedCount % 10 === 0) {
        process.stdout.write(`\r   Deleted ${deletedCount} items...`);
      }
    }

    lastEvaluatedKey = scanResult.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log(`\n   ✅ Deleted ${deletedCount} items from ${tableName}`);
  return deletedCount;
}

async function main() {
  console.log('================================================');
  console.log('🗄️  SiteLogix Database Clear');
  console.log('================================================');
  console.log('⚠️  WARNING: This will delete ALL data from all tables!');
  console.log('');

  let totalDeleted = 0;

  for (const tableName of TABLES) {
    try {
      const count = await clearTable(tableName);
      totalDeleted += count;
    } catch (error) {
      console.error(`   ❌ Error clearing ${tableName}:`, error.message);
    }
  }

  console.log('\n================================================');
  console.log(`✅ Database Clear Complete!`);
  console.log(`📊 Total items deleted: ${totalDeleted}`);
  console.log('================================================\n');
}

main().catch(console.error);
