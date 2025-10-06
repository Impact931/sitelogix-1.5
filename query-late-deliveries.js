/**
 * Query Late Deliveries from Reports
 */

require('dotenv').config();
const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });

async function queryLateDeliveries() {
  console.log('🔍 Scanning reports for delivery data...\n');

  const command = new ScanCommand({
    TableName: 'sitelogix-reports'
  });

  const result = await dynamoClient.send(command);
  const reports = result.Items.map(item => unmarshall(item));

  let totalDeliveries = 0;
  let lateDeliveries = 0;
  let onTimeDeliveries = 0;
  const lateDeliveryDetails = [];

  reports.forEach(report => {
    if (report.deliveries && Array.isArray(report.deliveries)) {
      report.deliveries.forEach(delivery => {
        totalDeliveries++;

        const isLate = delivery.status?.toLowerCase().includes('late') ||
                      delivery.status?.toLowerCase().includes('delayed') ||
                      delivery.notes?.toLowerCase().includes('late') ||
                      delivery.notes?.toLowerCase().includes('delayed');

        if (isLate) {
          lateDeliveries++;
          lateDeliveryDetails.push({
            reportDate: report.report_date,
            reportId: report.report_id,
            vendor: delivery.vendor || delivery.supplier || 'Unknown',
            item: delivery.item || delivery.material || 'Unknown',
            status: delivery.status || 'N/A',
            notes: delivery.notes || 'N/A'
          });
        } else {
          onTimeDeliveries++;
        }
      });
    }
  });

  console.log('='.repeat(80));
  console.log('📊 DELIVERY SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Deliveries: ${totalDeliveries}`);
  console.log(`Late Deliveries: ${lateDeliveries}`);
  console.log(`On-Time Deliveries: ${onTimeDeliveries}`);

  if (totalDeliveries > 0) {
    const latePercentage = ((lateDeliveries / totalDeliveries) * 100).toFixed(1);
    console.log(`Late Delivery Rate: ${latePercentage}%`);
  }

  console.log('='.repeat(80));

  if (lateDeliveryDetails.length > 0) {
    console.log('\n📋 LATE DELIVERY DETAILS:\n');
    lateDeliveryDetails.forEach((detail, index) => {
      console.log(`${index + 1}. ${detail.reportDate} (${detail.reportId})`);
      console.log(`   Vendor: ${detail.vendor}`);
      console.log(`   Item: ${detail.item}`);
      console.log(`   Status: ${detail.status}`);
      console.log(`   Notes: ${detail.notes}`);
      console.log('');
    });
  }
}

queryLateDeliveries().catch(console.error);
