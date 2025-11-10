/**
 * Personnel Service Usage Examples
 *
 * Practical examples showing how to use personnelService in real-world scenarios
 */

import { personnelService } from './personnelService';

// ============================================================================
// EXAMPLE 1: Processing Voice Report with Employee Names
// ============================================================================

async function processVoiceReport() {
  console.log('\n=== EXAMPLE 1: Processing Voice Report ===\n');

  // Simulate a voice report transcript mentioning several employees
  const transcript = `
    Today on the Riverside Tower project we had Bob Smith,
    Jennifer (our foreman), and Mike working the steel installation.
    Bobby put in 8 hours regular time, Jen worked 10 hours including
    2 overtime, and Mike Johnson did 8 hours.
  `;

  // Extract employee names from transcript (in real app, use AI)
  const employeeNames = ['Bob Smith', 'Jennifer', 'Mike Johnson'];
  const context = {
    projectId: 'PROJECT-RIVERSIDE-TOWER',
    reportDate: '2025-01-06',
    reportId: 'REPORT-20250106-001',
  };

  // Match or create each employee
  for (const name of employeeNames) {
    const result = await personnelService.matchOrCreateEmployee(name, context);

    console.log(`Employee: "${name}"`);
    console.log(`  → Matched ID: ${result.employeeId}`);
    console.log(`  → Confidence: ${result.confidence}`);
    console.log(`  → Match Method: ${result.matchMethod}`);
    console.log(`  → Needs Review: ${result.needsReview}`);

    if (result.suggestedMatches && result.suggestedMatches.length > 0) {
      console.log(`  → Suggested Matches:`);
      result.suggestedMatches.forEach((match) => {
        console.log(
          `    • ${match.name} (${match.confidence.toFixed(1)}% - ${match.reason})`
        );
      });
    }
    console.log('');
  }
}

// ============================================================================
// EXAMPLE 2: Creating a Complete Employee Profile
// ============================================================================

async function createCompleteEmployeeProfile() {
  console.log('\n=== EXAMPLE 2: Creating Complete Employee Profile ===\n');

  const employee = await personnelService.createEmployee({
    firstName: 'Robert',
    lastName: 'Johnson',
    middleName: 'James',
    preferredName: 'Bob',
    email: 'bob.johnson@constructionco.com',
    phone: '555-0123',
    hireDate: '2024-03-15',
    employmentStatus: 'active',
    hourlyRate: 45.5,
    overtimeRate: 68.25, // 1.5x
    jobTitle: 'Lead Electrician',
    createdByUserId: 'admin-001',
  });

  console.log('Created Employee:');
  console.log(`  ID: ${employee.personId}`);
  console.log(`  Employee Number: ${employee.employeeNumber}`);
  console.log(`  Full Name: ${employee.fullName}`);
  console.log(`  Preferred Name: ${employee.preferredName}`);
  console.log(`  Email: ${employee.email}`);
  console.log(`  Job Title: ${employee.jobTitle}`);
  console.log(`  Hourly Rate: $${employee.hourlyRate}`);
  console.log(`  Needs Profile Completion: ${employee.needsProfileCompletion}`);
  console.log('');
}

// ============================================================================
// EXAMPLE 3: Handling Nicknames and Aliases
// ============================================================================

async function handleNicknamesAndAliases() {
  console.log('\n=== EXAMPLE 3: Handling Nicknames and Aliases ===\n');

  // Create employee with formal name
  const employee = await personnelService.createEmployee({
    firstName: 'Christopher',
    lastName: 'Anderson',
    email: 'christopher.anderson@example.com',
  });

  console.log(`Created: ${employee.fullName} (${employee.personId})`);

  // Add common nicknames
  const nicknames = ['Chris', 'Chris A', 'Andy'];
  for (const nickname of nicknames) {
    await personnelService.addEmployeeAlias(employee.personId, nickname);
    console.log(`  Added alias: "${nickname}"`);
  }

  // Now try matching with different name variations
  console.log('\nMatching with variations:');

  const variations = ['Christopher Anderson', 'Chris Anderson', 'Chris A', 'Andy'];
  for (const variation of variations) {
    const result = await personnelService.matchOrCreateEmployee(variation);
    console.log(
      `  "${variation}" → ${result.confidence} match (${result.matchMethod})`
    );
  }
  console.log('');
}

// ============================================================================
// EXAMPLE 4: Fuzzy Matching with Typos
// ============================================================================

async function demonstrateFuzzyMatching() {
  console.log('\n=== EXAMPLE 4: Fuzzy Matching with Typos ===\n');

  // Create employee with correct spelling
  const employee = await personnelService.createEmployee({
    firstName: 'Michael',
    lastName: 'Rodriguez',
  });

  console.log(`Created: ${employee.fullName} (${employee.personId})\n`);

  // Try matching with common typos and misspellings
  const typos = [
    'Micheal Rodriguez', // Common misspelling
    'Michael Rodriquez', // Missing 'g'
    'Michal Rodriguez', // Missing 'e'
    'Michael Rodrigez', // Missing 'u'
  ];

  console.log('Testing fuzzy matching:');
  for (const typo of typos) {
    const result = await personnelService.matchOrCreateEmployee(typo);
    const matched = result.employeeId === employee.personId;
    console.log(
      `  "${typo}" → ${matched ? '✅ MATCHED' : '❌ NOT MATCHED'} (${result.confidence})`
    );
  }
  console.log('');
}

// ============================================================================
// EXAMPLE 5: Detecting and Resolving Duplicates
// ============================================================================

async function detectAndResolveDuplicates() {
  console.log('\n=== EXAMPLE 5: Detecting and Resolving Duplicates ===\n');

  // Accidentally create two similar employees
  const emp1 = await personnelService.createEmployee({
    firstName: 'William',
    lastName: 'Thompson',
    email: 'bill.thompson@example.com',
    hourlyRate: 42.0,
  });

  const emp2 = await personnelService.createEmployee({
    firstName: 'Bill',
    lastName: 'Thompson',
    phone: '555-7890',
    jobTitle: 'Carpenter',
  });

  console.log(`Created Employee 1: ${emp1.fullName} (${emp1.personId})`);
  console.log(`Created Employee 2: ${emp2.fullName} (${emp2.personId})\n`);

  // Preview the merge
  const preview = await personnelService.suggestMerge(emp1.personId, emp2.personId);

  console.log('Merge Preview:');
  console.log(`  Primary: ${preview.primaryEmployee.fullName}`);
  console.log(`  Duplicate: ${preview.duplicateEmployee.fullName}`);
  console.log(`\n  Conflicts Detected: ${preview.conflicts.length}`);

  if (preview.conflicts.length > 0) {
    console.log('  Field Conflicts:');
    preview.conflicts.forEach((conflict) => {
      console.log(`    • ${conflict.field}:`);
      console.log(`      Primary: ${conflict.primaryValue}`);
      console.log(`      Duplicate: ${conflict.duplicateValue}`);
    });
  }

  console.log(`\n  Aliases to Merge: ${preview.aliasesToMerge.join(', ')}`);

  // Perform the merge
  const merged = await personnelService.mergeEmployees(emp1.personId, emp2.personId);

  console.log('\nMerge Complete:');
  console.log(`  Merged Employee: ${merged.fullName}`);
  console.log(`  All Aliases: ${merged.knownAliases.join(', ')}`);
  console.log(`  Email: ${merged.email}`);
  console.log(`  Phone: ${merged.phone}`);
  console.log(`  Job Title: ${merged.jobTitle}`);
  console.log('');
}

// ============================================================================
// EXAMPLE 6: Searching and Filtering Employees
// ============================================================================

async function searchAndFilterEmployees() {
  console.log('\n=== EXAMPLE 6: Searching and Filtering Employees ===\n');

  // Create some test employees
  await personnelService.createEmployee({
    firstName: 'John',
    lastName: 'Smith',
    employmentStatus: 'active',
  });

  await personnelService.createEmployee({
    firstName: 'Jane',
    lastName: 'Smith',
    employmentStatus: 'active',
  });

  await personnelService.createEmployee({
    firstName: 'John',
    lastName: 'Doe',
    employmentStatus: 'inactive',
  });

  // Search by partial name
  console.log('Search Results for "Smith":');
  const smiths = await personnelService.searchEmployeesByName('Smith');
  smiths.forEach((emp) => {
    console.log(
      `  • ${emp.fullName} (${emp.employmentStatus}) - ${emp.personId}`
    );
  });

  // List all active employees
  console.log('\nAll Active Employees:');
  const activeEmployees = await personnelService.listEmployees({ status: 'active' });
  console.log(`  Found ${activeEmployees.length} active employees`);

  // List employees needing profile completion
  console.log('\nEmployees Needing Profile Completion:');
  const incompleteProfiles = await personnelService.listEmployees({
    needsProfileCompletion: true,
  });
  console.log(`  Found ${incompleteProfiles.length} incomplete profiles`);
  incompleteProfiles.forEach((emp) => {
    console.log(`  • ${emp.fullName} - Missing: email, phone, or hire date`);
  });
  console.log('');
}

// ============================================================================
// EXAMPLE 7: Updating Employee Information
// ============================================================================

async function updateEmployeeInformation() {
  console.log('\n=== EXAMPLE 7: Updating Employee Information ===\n');

  // Create employee with incomplete profile
  const employee = await personnelService.createEmployee({
    firstName: 'Sarah',
    lastName: 'Martinez',
  });

  console.log('Initial Employee:');
  console.log(`  Name: ${employee.fullName}`);
  console.log(`  Email: ${employee.email || 'NOT SET'}`);
  console.log(`  Phone: ${employee.phone || 'NOT SET'}`);
  console.log(`  Hourly Rate: ${employee.hourlyRate || 'NOT SET'}`);
  console.log(`  Needs Profile Completion: ${employee.needsProfileCompletion}\n`);

  // Update employee with complete information
  const updated = await personnelService.updateEmployee(employee.personId, {
    email: 'sarah.martinez@example.com',
    phone: '555-4567',
    hireDate: '2025-01-01',
    hourlyRate: 38.5,
    overtimeRate: 57.75,
    jobTitle: 'Plumber',
    needsProfileCompletion: false,
  });

  console.log('Updated Employee:');
  console.log(`  Name: ${updated.fullName}`);
  console.log(`  Email: ${updated.email}`);
  console.log(`  Phone: ${updated.phone}`);
  console.log(`  Hourly Rate: $${updated.hourlyRate}`);
  console.log(`  Job Title: ${updated.jobTitle}`);
  console.log(`  Needs Profile Completion: ${updated.needsProfileCompletion}`);
  console.log('');
}

// ============================================================================
// EXAMPLE 8: Employee Lifecycle (Hire to Termination)
// ============================================================================

async function employeeLifecycle() {
  console.log('\n=== EXAMPLE 8: Employee Lifecycle ===\n');

  // Step 1: Employee first mentioned in voice report
  console.log('Step 1: First mention in voice report');
  const voiceMatch = await personnelService.matchOrCreateEmployee('Tom Brady', {
    reportDate: '2025-01-01',
    reportId: 'REPORT-001',
  });

  console.log(`  → Auto-created: ${voiceMatch.employeeId}`);
  console.log(`  → Needs Profile Completion: ${voiceMatch.needsReview || 'Unknown'}\n`);

  // Step 2: HR completes the profile
  console.log('Step 2: HR completes the profile');
  const completed = await personnelService.updateEmployee(voiceMatch.employeeId, {
    email: 'tom.brady@example.com',
    phone: '555-1234',
    hireDate: '2025-01-01',
    hourlyRate: 35.0,
    overtimeRate: 52.5,
    jobTitle: 'Laborer',
    needsProfileCompletion: false,
  });

  console.log(`  → Profile completed for: ${completed.fullName}\n`);

  // Step 3: Employee gets promoted
  console.log('Step 3: Employee promotion');
  const promoted = await personnelService.updateEmployee(voiceMatch.employeeId, {
    jobTitle: 'Lead Laborer',
    hourlyRate: 40.0,
    overtimeRate: 60.0,
  });

  console.log(`  → New Title: ${promoted.jobTitle}`);
  console.log(`  → New Rate: $${promoted.hourlyRate}/hr\n`);

  // Step 4: Employee leaves company
  console.log('Step 4: Employee termination');
  await personnelService.terminateEmployee(voiceMatch.employeeId);

  const terminated = await personnelService.getEmployeeById(voiceMatch.employeeId);
  console.log(`  → Status: ${terminated?.employmentStatus}`);
  console.log('');
}

// ============================================================================
// RUN ALL EXAMPLES
// ============================================================================

async function runAllExamples() {
  try {
    await processVoiceReport();
    await createCompleteEmployeeProfile();
    await handleNicknamesAndAliases();
    await demonstrateFuzzyMatching();
    await detectAndResolveDuplicates();
    await searchAndFilterEmployees();
    await updateEmployeeInformation();
    await employeeLifecycle();

    console.log('✅ All examples completed successfully!');
  } catch (error) {
    console.error('❌ Error running examples:', error);
  }
}

// Export for use in other files
export {
  processVoiceReport,
  createCompleteEmployeeProfile,
  handleNicknamesAndAliases,
  demonstrateFuzzyMatching,
  detectAndResolveDuplicates,
  searchAndFilterEmployees,
  updateEmployeeInformation,
  employeeLifecycle,
  runAllExamples,
};

// Run if executed directly
if (require.main === module) {
  runAllExamples();
}
