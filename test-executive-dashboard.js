/**
 * Test script for Executive Dashboard BI endpoint
 * Tests with live DynamoDB data
 */

const { getExecutiveDashboard } = require('./backend/src/functions/bi-endpoints');

async function testExecutiveDashboard() {
  console.log('Testing Executive Dashboard endpoint...\n');

  try {
    const result = await getExecutiveDashboard();

    if (!result.success) {
      console.error('❌ Executive Dashboard endpoint returned error:', result.error);
      process.exit(1);
    }

    const dashboard = result.dashboard;

    console.log('=== EXECUTIVE DASHBOARD RESULTS ===\n');
    console.log('Portfolio Health:', JSON.stringify(dashboard.portfolio_health, null, 2));
    console.log('\nFinancial Snapshot:', JSON.stringify(dashboard.financial_snapshot, null, 2));
    console.log('\nTop Wins:', dashboard.top_wins.length, 'items');
    console.log(JSON.stringify(dashboard.top_wins.slice(0, 3), null, 2));
    console.log('\nTop Concerns:', dashboard.top_concerns.length, 'items');
    console.log(JSON.stringify(dashboard.top_concerns.slice(0, 3), null, 2));
    console.log('\nUrgent Actions:', dashboard.urgent_actions.length, 'items');
    console.log(JSON.stringify(dashboard.urgent_actions.slice(0, 3), null, 2));
    console.log('\nProjects:', dashboard.projects.length, 'total');

    console.log('\n✅ Executive Dashboard endpoint test PASSED');
  } catch (error) {
    console.error('❌ Executive Dashboard endpoint test FAILED');
    console.error(error);
    process.exit(1);
  }
}

testExecutiveDashboard();
