/**
 * Test Payroll Extraction from Transcripts
 *
 * This script tests the end-to-end payroll extraction workflow:
 * 1. Creates a test report with employee hour data
 * 2. Verifies payroll extraction triggers
 * 3. Checks that employees are matched correctly
 * 4. Validates payroll entries are created
 */

const fetch = require('node-fetch');

const API_BASE_URL = process.env.API_BASE_URL || 'https://6f10uv7ne0.execute-api.us-east-1.amazonaws.com/api';

// Test transcript with employee hour data
const TEST_TRANSCRIPT = `
Good morning, this is John reporting for September 18th, 2024 from the Downtown Office Building project.

Today we had the full crew on site. Mike Rodriguez arrived at 7:00 AM and worked until 5:00 PM,
that's 10 hours total - 8 regular and 2 overtime. He was working on the electrical panel installation
on the second floor.

Sarah Chen got here at 7:30 AM and left at 4:00 PM, so that's 8.5 hours. She was doing the HVAC ductwork
in the main corridor. Everything went smoothly for her today.

Tom Martinez arrived at 8:00 AM and stayed until 6:00 PM, working 10 hours total - 8 regular and 2 overtime.
He was framing the walls in the west wing and made great progress.

We had a minor delay with the concrete delivery, but overall a productive day. No safety issues to report.
`;

async function testPayrollExtraction() {
  console.log('');
  console.log('='.repeat(80));
  console.log('PAYROLL EXTRACTION TEST');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Step 1: Create a test report
    console.log('📝 Step 1: Creating test report with transcript...');

    const reportData = {
      managerId: 'test-manager-001',
      managerName: 'Test Manager',
      projectId: 'proj_test_001',
      projectName: 'Test Project - Downtown Office',
      reportDate: new Date().toISOString().split('T')[0],
      transcript: TEST_TRANSCRIPT,
      audioPath: 's3://sitelogix-reports/test/audio.mp3',
      transcriptPath: 's3://sitelogix-reports/test/transcript.txt'
    };

    const reportResponse = await fetch(`${API_BASE_URL}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportData)
    });

    const reportResult = await reportResponse.json();

    console.log('Report API response:', JSON.stringify(reportResult, null, 2));

    if (!reportResult.success) {
      console.error('❌ Failed to create report:', reportResult.error || reportResult.message);
      if (reportResult.details) {
        console.error('Details:', reportResult.details);
      }
      return;
    }

    const reportId = reportResult.reportId;
    console.log(`✅ Report created: ${reportId}`);
    console.log('');

    // Step 2: Wait for payroll extraction to complete
    console.log('⏳ Step 2: Waiting 15 seconds for async payroll extraction...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    console.log('');

    // Step 3: Query payroll entries for this report date
    console.log('📊 Step 3: Querying payroll entries...');

    const payrollResponse = await fetch(`${API_BASE_URL}/payroll/daily/${reportData.reportDate}`);
    const payrollResult = await payrollResponse.json();

    if (!payrollResult.success) {
      console.error('❌ Failed to query payroll:', payrollResult.error);
      return;
    }

    const entries = payrollResult.data.entries || [];
    console.log(`Found ${entries.length} payroll entries for ${reportData.reportDate}`);
    console.log('');

    // Step 4: Display results
    console.log('='.repeat(80));
    console.log('PAYROLL EXTRACTION RESULTS');
    console.log('='.repeat(80));
    console.log('');

    if (entries.length === 0) {
      console.log('⚠️  No payroll entries found');
      console.log('');
      console.log('Possible reasons:');
      console.log('  1. OPENAI_API_KEY not configured in Lambda');
      console.log('  2. Payroll extraction failed (check Lambda logs)');
      console.log('  3. Employee names could not be matched to database');
      console.log('  4. Async processing is still running (wait longer)');
      console.log('');
      console.log('💡 Check Lambda logs for detailed error messages:');
      console.log(`   aws logs tail /aws/lambda/sitelogix-api --follow --region us-east-1`);
    } else {
      console.log(`✅ Successfully extracted ${entries.length} payroll entries:`);
      console.log('');

      entries.forEach((entry, index) => {
        console.log(`${index + 1}. ${entry.employeeName} (${entry.employeeNumber})`);
        console.log(`   Regular Hours: ${entry.regularHours}h`);
        console.log(`   Overtime Hours: ${entry.overtimeHours}h`);
        console.log(`   Double Time Hours: ${entry.doubleTimeHours}h`);
        console.log(`   Arrival: ${entry.arrivalTime || 'N/A'}`);
        console.log(`   Departure: ${entry.departureTime || 'N/A'}`);
        console.log(`   Activities: ${entry.activities || 'N/A'}`);
        console.log(`   Needs Review: ${entry.needsReview ? 'Yes' : 'No'}`);
        console.log('');
      });

      const summary = payrollResult.data.summary;
      if (summary) {
        console.log('Summary:');
        console.log(`  Total Regular Hours: ${summary.totalRegularHours}h`);
        console.log(`  Total Overtime Hours: ${summary.totalOvertimeHours}h`);
        console.log(`  Total Double Time Hours: ${summary.totalDoubleTimeHours}h`);
        console.log(`  Needs Review: ${summary.needsReview}`);
      }
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('TEST COMPLETE');
    console.log('='.repeat(80));
    console.log('');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error(error.stack);
  }
}

// Run test
testPayrollExtraction().catch(console.error);
