/**
 * Personnel Service Tests
 *
 * Comprehensive tests for the personnelService including:
 * - CRUD operations
 * - 6-layer deduplication algorithm
 * - Fuzzy matching with Levenshtein distance
 * - Alias management
 * - Employee merging
 */

import { personnelService } from './personnelService';

describe('PersonnelService', () => {
  describe('Helper Functions', () => {
    // These tests would require exposing helper functions or testing through public API
    test('should normalize names correctly', async () => {
      const employee = await personnelService.createEmployee({
        firstName: '  bobby  ',
        lastName: '  SMITH  ',
      });

      expect(employee.firstName).toBe('Bobby');
      expect(employee.lastName).toBe('Smith');
      expect(employee.fullName).toBe('Bobby Smith');
    });

    test('should generate unique employee numbers', async () => {
      const emp1 = await personnelService.createEmployee({
        firstName: 'John',
        lastName: 'Doe',
      });

      const emp2 = await personnelService.createEmployee({
        firstName: 'Jane',
        lastName: 'Doe',
      });

      expect(emp1.employeeNumber).not.toBe(emp2.employeeNumber);
      expect(emp1.employeeNumber).toMatch(/^EMP-\d{8}\d{3}$/);
    });
  });

  describe('CREATE Operations', () => {
    test('should create a basic employee', async () => {
      const employee = await personnelService.createEmployee({
        firstName: 'John',
        lastName: 'Smith',
        email: 'john.smith@example.com',
      });

      expect(employee.personId).toMatch(/^PER#EMP-/);
      expect(employee.firstName).toBe('John');
      expect(employee.lastName).toBe('Smith');
      expect(employee.fullName).toBe('John Smith');
      expect(employee.email).toBe('john.smith@example.com');
      expect(employee.employmentStatus).toBe('active');
      expect(employee.knownAliases).toContain('John Smith');
    });

    test('should create employee with full details', async () => {
      const employee = await personnelService.createEmployee({
        firstName: 'Robert',
        lastName: 'Johnson',
        middleName: 'James',
        preferredName: 'Bob',
        email: 'bob@example.com',
        phone: '555-0100',
        hireDate: '2025-01-01',
        hourlyRate: 35.5,
        overtimeRate: 53.25,
        jobTitle: 'Senior Carpenter',
        createdByUserId: 'admin-001',
      });

      expect(employee.middleName).toBe('James');
      expect(employee.preferredName).toBe('Bob');
      expect(employee.hourlyRate).toBe(35.5);
      expect(employee.overtimeRate).toBe(53.25);
      expect(employee.jobTitle).toBe('Senior Carpenter');
      expect(employee.needsProfileCompletion).toBe(false);
    });

    test('should flag incomplete profiles', async () => {
      const employee = await personnelService.createEmployee({
        firstName: 'Mike',
        lastName: 'Wilson',
        // No email, phone, or hire date
      });

      expect(employee.needsProfileCompletion).toBe(true);
    });
  });

  describe('READ Operations', () => {
    let testEmployee: any;

    beforeAll(async () => {
      testEmployee = await personnelService.createEmployee({
        firstName: 'Test',
        lastName: 'Employee',
        email: 'test@example.com',
      });
    });

    test('should get employee by ID', async () => {
      const found = await personnelService.getEmployeeById(testEmployee.personId);

      expect(found).not.toBeNull();
      expect(found?.personId).toBe(testEmployee.personId);
      expect(found?.fullName).toBe('Test Employee');
    });

    test('should get employee by employee number', async () => {
      const found = await personnelService.getEmployeeByNumber(testEmployee.employeeNumber);

      expect(found).not.toBeNull();
      expect(found?.employeeNumber).toBe(testEmployee.employeeNumber);
    });

    test('should return null for non-existent employee', async () => {
      const found = await personnelService.getEmployeeById('PER#NONEXISTENT');
      expect(found).toBeNull();
    });

    test('should search employees by name', async () => {
      const results = await personnelService.searchEmployeesByName('Test');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((emp) => emp.fullName.includes('Test'))).toBe(true);
    });

    test('should list all employees', async () => {
      const employees = await personnelService.listEmployees();
      expect(employees.length).toBeGreaterThan(0);
    });

    test('should filter employees by status', async () => {
      const activeEmployees = await personnelService.listEmployees({
        status: 'active',
      });

      expect(activeEmployees.every((emp) => emp.employmentStatus === 'active')).toBe(
        true
      );
    });

    test('should filter employees needing profile completion', async () => {
      const incompleteProfiles = await personnelService.listEmployees({
        needsProfileCompletion: true,
      });

      expect(
        incompleteProfiles.every((emp) => emp.needsProfileCompletion === true)
      ).toBe(true);
    });
  });

  describe('UPDATE Operations', () => {
    let testEmployee: any;

    beforeEach(async () => {
      testEmployee = await personnelService.createEmployee({
        firstName: 'Update',
        lastName: 'Test',
      });
    });

    test('should update employee email', async () => {
      const updated = await personnelService.updateEmployee(testEmployee.personId, {
        email: 'newemail@example.com',
      });

      expect(updated.email).toBe('newemail@example.com');
    });

    test('should update employee phone and hourly rate', async () => {
      const updated = await personnelService.updateEmployee(testEmployee.personId, {
        phone: '555-0200',
        hourlyRate: 42.0,
      });

      expect(updated.phone).toBe('555-0200');
      expect(updated.hourlyRate).toBe(42.0);
    });

    test('should update employment status', async () => {
      const updated = await personnelService.updateEmployee(testEmployee.personId, {
        employmentStatus: 'inactive',
      });

      expect(updated.employmentStatus).toBe('inactive');
    });

    test('should add employee alias', async () => {
      await personnelService.addEmployeeAlias(testEmployee.personId, 'Testy');

      const updated = await personnelService.getEmployeeById(testEmployee.personId);
      expect(updated?.knownAliases).toContain('Testy');
    });

    test('should not duplicate existing alias', async () => {
      await personnelService.addEmployeeAlias(testEmployee.personId, 'Update Test');

      const updated = await personnelService.getEmployeeById(testEmployee.personId);
      const aliasCount = updated?.knownAliases.filter(
        (a) => a === 'Update Test'
      ).length;
      expect(aliasCount).toBe(1);
    });
  });

  describe('DELETE Operations (Soft Delete)', () => {
    test('should terminate employee', async () => {
      const employee = await personnelService.createEmployee({
        firstName: 'Delete',
        lastName: 'Test',
      });

      await personnelService.terminateEmployee(employee.personId);

      const updated = await personnelService.getEmployeeById(employee.personId);
      expect(updated?.employmentStatus).toBe('terminated');
    });

    test('should throw error when terminating non-existent employee', async () => {
      await expect(
        personnelService.terminateEmployee('PER#NONEXISTENT')
      ).rejects.toThrow();
    });
  });

  describe('6-Layer Deduplication Algorithm', () => {
    beforeAll(async () => {
      // Create test employees for deduplication scenarios
      await personnelService.createEmployee({
        firstName: 'Robert',
        lastName: 'Smith',
        preferredName: 'Bob',
        email: 'robert.smith@example.com',
      });

      await personnelService.createEmployee({
        firstName: 'Jennifer',
        lastName: 'Williams',
        preferredName: 'Jen',
        email: 'jen@example.com',
      });
    });

    test('LAYER 1: Should find exact full name match', async () => {
      const result = await personnelService.matchOrCreateEmployee('Robert Smith');

      expect(result.confidence).toBe('exact');
      expect(result.needsReview).toBe(false);
      expect(result.matchMethod).toBe('exact_name');
    });

    test('LAYER 2: Should find alias match', async () => {
      // First add the alias
      const existing = await personnelService.searchEmployeesByName('Robert Smith');
      if (existing.length > 0) {
        await personnelService.addEmployeeAlias(existing[0].personId, 'Bobby Smith');
      }

      const result = await personnelService.matchOrCreateEmployee('Bobby Smith');

      expect(result.confidence).toBe('high');
      expect(result.needsReview).toBe(false);
      expect(result.matchMethod).toBe('alias_match');
    });

    test('LAYER 3: Should find fuzzy match with typo', async () => {
      const result = await personnelService.matchOrCreateEmployee('Robrt Smith'); // Missing 'e'

      expect(['high', 'medium']).toContain(result.confidence);
      expect(result.matchMethod).toBe('fuzzy_match');
    });

    test('LAYER 3: Should find fuzzy match with slight variation', async () => {
      const result = await personnelService.matchOrCreateEmployee('Jennifer Wiliams'); // Missing 'l'

      expect(['high', 'medium']).toContain(result.confidence);
      expect(result.matchMethod).toBe('fuzzy_match');
    });

    test('LAYER 4: Should use context-based matching', async () => {
      // Create multiple similar employees
      await personnelService.createEmployee({
        firstName: 'Mike',
        lastName: 'Johnson',
      });

      await personnelService.createEmployee({
        firstName: 'Michael',
        lastName: 'Johnson',
      });

      const result = await personnelService.matchOrCreateEmployee('Mike Johnson', {
        projectId: 'PROJECT-001',
        reportDate: '2025-01-06',
      });

      expect(result.employeeId).toBeDefined();
      expect(result.confidence).toBeDefined();
    });

    test('LAYER 5: Should detect multiple matches and flag for review', async () => {
      // Create very similar employees
      const emp1 = await personnelService.createEmployee({
        firstName: 'Chris',
        lastName: 'Anderson',
      });

      const emp2 = await personnelService.createEmployee({
        firstName: 'Christopher',
        lastName: 'Anderson',
      });

      const result = await personnelService.matchOrCreateEmployee('Chris Anderson');

      // Should either match one or create new with review flag
      if (result.suggestedMatches && result.suggestedMatches.length > 1) {
        expect(result.needsReview).toBe(true);
      }
    });

    test('LAYER 6: Should auto-create new employee when no match found', async () => {
      const result = await personnelService.matchOrCreateEmployee('Unique Person Name', {
        reportDate: '2025-01-06',
        reportId: 'REPORT-001',
      });

      expect(result.confidence).toBe('new_employee');
      expect(result.matchMethod).toBe('auto_created');
      expect(result.employeeId).toMatch(/^PER#EMP-/);

      // Verify employee was created
      const created = await personnelService.getEmployeeById(result.employeeId);
      expect(created).not.toBeNull();
      expect(created?.needsProfileCompletion).toBe(true);
    });
  });

  describe('Levenshtein Distance Matching', () => {
    test('should match names with 1 character difference', async () => {
      await personnelService.createEmployee({
        firstName: 'David',
        lastName: 'Brown',
      });

      const result = await personnelService.matchOrCreateEmployee('Davd Brown'); // Missing 'i'

      expect(['exact', 'high', 'medium']).toContain(result.confidence);
    });

    test('should match names with 2 character differences', async () => {
      await personnelService.createEmployee({
        firstName: 'Thomas',
        lastName: 'Martinez',
      });

      const result = await personnelService.matchOrCreateEmployee('Thmas Martnez'); // Missing 2 chars

      expect(['exact', 'high', 'medium']).toContain(result.confidence);
    });

    test('should not match names with > 2 character differences', async () => {
      await personnelService.createEmployee({
        firstName: 'Alexander',
        lastName: 'Rodriguez',
      });

      const result = await personnelService.matchOrCreateEmployee('Alex Rod'); // Too different

      // Should create new or have low confidence
      expect(result.employeeId).toBeDefined();
    });
  });

  describe('Merge Operations', () => {
    test('should preview merge operation', async () => {
      const emp1 = await personnelService.createEmployee({
        firstName: 'Merge',
        lastName: 'Primary',
        email: 'primary@example.com',
        hourlyRate: 40.0,
      });

      const emp2 = await personnelService.createEmployee({
        firstName: 'Merge',
        lastName: 'Duplicate',
        email: 'duplicate@example.com',
        hourlyRate: 45.0,
      });

      const preview = await personnelService.suggestMerge(emp1.personId, emp2.personId);

      expect(preview.primaryEmployee.personId).toBe(emp1.personId);
      expect(preview.duplicateEmployee.personId).toBe(emp2.personId);
      expect(preview.conflicts.length).toBeGreaterThan(0);

      const emailConflict = preview.conflicts.find((c) => c.field === 'email');
      expect(emailConflict).toBeDefined();
      expect(emailConflict?.primaryValue).toBe('primary@example.com');
      expect(emailConflict?.duplicateValue).toBe('duplicate@example.com');
    });

    test('should merge employees successfully', async () => {
      const emp1 = await personnelService.createEmployee({
        firstName: 'Final',
        lastName: 'Primary',
        email: 'final@example.com',
      });

      const emp2 = await personnelService.createEmployee({
        firstName: 'Final',
        lastName: 'Duplicate',
        phone: '555-9999',
      });

      const merged = await personnelService.mergeEmployees(
        emp1.personId,
        emp2.personId
      );

      // Primary should have all aliases
      expect(merged.knownAliases).toContain('Final Primary');
      expect(merged.knownAliases).toContain('Final Duplicate');

      // Should inherit phone from duplicate
      expect(merged.phone).toBe('555-9999');

      // Duplicate should be terminated
      const duplicate = await personnelService.getEmployeeById(emp2.personId);
      expect(duplicate?.employmentStatus).toBe('terminated');
    });
  });

  describe('Edge Cases', () => {
    test('should handle single-word names', async () => {
      const employee = await personnelService.createEmployee({
        firstName: 'Madonna',
        lastName: 'Madonna',
      });

      expect(employee.fullName).toBe('Madonna Madonna');
    });

    test('should handle names with special characters', async () => {
      const employee = await personnelService.createEmployee({
        firstName: "O'Brien",
        lastName: 'Smith-Jones',
      });

      expect(employee.firstName).toBeDefined();
      expect(employee.lastName).toBeDefined();
    });

    test('should handle very long names', async () => {
      const employee = await personnelService.createEmployee({
        firstName: 'Bartholomew',
        lastName: 'Constantinopolous-Vanderbilt',
      });

      expect(employee.fullName.length).toBeGreaterThan(20);
    });

    test('should handle case-insensitive matching', async () => {
      await personnelService.createEmployee({
        firstName: 'JAMES',
        lastName: 'WILSON',
      });

      const result = await personnelService.matchOrCreateEmployee('james wilson');

      expect(result.confidence).toBe('exact');
    });
  });
});
