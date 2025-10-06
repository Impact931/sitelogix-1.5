/**
 * Test CFO Analytics Agent
 */

async function testAnalytics() {
  console.log('='.repeat(80));
  console.log('🧪 Testing CFO Analytics Agent');
  console.log('='.repeat(80));
  console.log('');

  // Test 1: Insights endpoint
  console.log('📊 Test 1: Getting executive insights...\n');
  const insightsResponse = await fetch('http://localhost:3002/api/analytics/insights');
  const insights = await insightsResponse.json();

  console.log('INSIGHTS:');
  console.log(JSON.stringify(insights, null, 2));
  console.log('');
  console.log('='.repeat(80));
  console.log('');

  // Test 2: Natural language query
  console.log('💬 Test 2: Natural language query...\n');
  console.log('Query: "How many late deliveries did we have and what is the cost impact?"\n');

  const queryResponse = await fetch('http://localhost:3002/api/analytics/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'How many late deliveries did we have in our reporting? Analyze the impact on project timelines and costs. Which vendors are the biggest offenders? Provide specific recommendations to improve vendor performance.'
    })
  });

  const analysis = await queryResponse.json();

  console.log('ANALYSIS:');
  console.log('');
  console.log(analysis.analysis);
  console.log('');
  console.log('='.repeat(80));
  console.log('');

  // Test 3: Overtime analysis
  console.log('💬 Test 3: Overtime cost analysis...\n');
  console.log('Query: "Analyze our overtime patterns and recommend cost reduction strategies"\n');

  const overtimeResponse = await fetch('http://localhost:3002/api/analytics/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'Analyze our overtime patterns. What percentage of labor costs are overtime? Which projects have the highest overtime? What are the top 3 recommendations to reduce overtime costs while maintaining productivity?'
    })
  });

  const overtimeAnalysis = await overtimeResponse.json();

  console.log('OVERTIME ANALYSIS:');
  console.log('');
  console.log(overtimeAnalysis.analysis);
  console.log('');
  console.log('='.repeat(80));
}

testAnalytics().catch(console.error);
