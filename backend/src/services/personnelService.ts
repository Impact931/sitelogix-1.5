/**
 * Personnel Service
 *
 * Complete personnel management service with intelligent 6-layer employee deduplication
 * Handles employee CRUD operations, smart name matching, alias tracking, and merge operations
 *
 * @module personnelService
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import * as bcrypt from 'bcryptjs';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Complete employee record
 */
interface Employee {
  personId: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  preferredName?: string;
  fullName: string; // Computed: "FirstName LastName"
  email?: string;
  phone?: string;
  hireDate?: string;
  employmentStatus: 'active' | 'inactive' | 'terminated';
  hourlyRate?: number;
  overtimeRate?: number;
  jobTitle?: string;
  knownAliases: string[];
  firstMentionedDate?: string;
  firstMentionedReportId?: string;
  lastSeenDate?: string;
  lastSeenProjectId?: string;
  needsProfileCompletion: boolean;
  createdByUserId?: string;
  // Authentication fields
  username?: string;
  passwordHash?: string;
  role?: 'admin' | 'manager' | 'foreman' | 'employee';
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating a new employee
 */
interface CreateEmployeeInput {
  firstName: string;
  lastName: string;
  middleName?: string;
  preferredName?: string;
  employeeNumber?: string; // User-provided employee number (e.g., "NO4", "PKW01")
  email?: string;
  phone?: string;
  hireDate?: string;
  employmentStatus?: 'active' | 'inactive' | 'terminated';
  hourlyRate?: number;
  overtimeRate?: number;
  jobTitle?: string;
  createdByUserId?: string;
  // Authentication fields
  username?: string;
  password?: string; // Plain text password (will be hashed)
  role?: 'admin' | 'manager' | 'foreman' | 'employee';
}

/**
 * Context for employee matching
 */
interface MatchContext {
  projectId?: string;
  reportDate?: string;
  reportId?: string;
}

/**
 * Result of employee matching operation
 */
interface MatchResult {
  employeeId: string;
  confidence: 'exact' | 'high' | 'medium' | 'new_employee';
  needsReview: boolean;
  matchedName?: string;
  matchMethod?: string;
  suggestedMatches?: Array<{
    employeeId: string;
    name: string;
    reason: string;
    confidence: number;
  }>;
}

/**
 * Preview of merge operation
 */
interface MergePreview {
  primaryEmployee: Employee;
  duplicateEmployee: Employee;
  conflicts: Array<{
    field: string;
    primaryValue: any;
    duplicateValue: any;
  }>;
  aliasesToMerge: string[];
  historyRecordsToMove: number;
}

/**
 * Filters for listing employees
 */
interface ListEmployeeFilters {
  status?: 'active' | 'inactive' | 'terminated';
  projectId?: string;
  needsProfileCompletion?: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize a name for consistent comparison
 * Converts to title case, removes extra whitespace
 *
 * @param name - Raw name string
 * @returns Normalized name
 *
 * @example
 * normalizeName("  bobby  SMITH  ") // "Bobby Smith"
 * normalizeName("john-paul jones") // "John-Paul Jones"
 */
function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\b\w/g, (char) => char.toUpperCase()); // Title case
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy name matching to handle typos
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Edit distance (number of changes needed)
 *
 * @example
 * levenshteinDistance("Robert", "Roberto") // 1
 * levenshteinDistance("Smith", "Smyth") // 1
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  // Create DP table
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill DP table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity percentage between two strings
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Similarity score (0-100)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 100;
  return ((maxLength - distance) / maxLength) * 100;
}

/**
 * Generate unique employee number
 *
 * @returns Employee number in format "EMP-YYYYMMDDXXX"
 *
 * @example
 * generateEmployeeNumber() // "EMP-20250106001"
 */
function generateEmployeeNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `EMP-${year}${month}${day}${random}`;
}

/**
 * Parse full name into components
 *
 * @param fullName - Full name string
 * @returns Name components
 *
 * @example
 * parseName("Robert James Smith") // { firstName: "Robert", middleName: "James", lastName: "Smith" }
 * parseName("Bob Smith") // { firstName: "Bob", lastName: "Smith" }
 * parseName("Madonna") // { firstName: "Madonna", lastName: "Madonna" }
 */
function parseName(fullName: string): {
  firstName: string;
  lastName: string;
  middleName?: string;
} {
  const normalized = normalizeName(fullName);
  const parts = normalized.split(' ').filter((p) => p.length > 0);

  if (parts.length === 0) {
    return { firstName: 'Unknown', lastName: 'Unknown' };
  } else if (parts.length === 1) {
    // Single name - use as both first and last
    return { firstName: parts[0], lastName: parts[0] };
  } else if (parts.length === 2) {
    return { firstName: parts[0], lastName: parts[1] };
  } else {
    // 3+ parts: first, middle(s), last
    return {
      firstName: parts[0],
      middleName: parts.slice(1, -1).join(' '),
      lastName: parts[parts.length - 1],
    };
  }
}

/**
 * Generate normalized alias key for DynamoDB
 *
 * @param alias - Alias string
 * @returns Normalized alias for SK
 */
function generateAliasKey(alias: string): string {
  return `ALIAS#${normalizeName(alias).toLowerCase().replace(/\s+/g, '_')}`;
}

// ============================================================================
// PERSONNEL SERVICE CLASS
// ============================================================================

/**
 * Personnel Service
 *
 * Manages all employee-related operations with intelligent deduplication
 */
class PersonnelService {
  private docClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor() {
    const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = process.env.PERSONNEL_TABLE || 'sitelogix-personnel';
  }

  // ==========================================================================
  // CREATE OPERATIONS
  // ==========================================================================

  /**
   * Create a new employee record
   *
   * @param data - Employee data
   * @returns Created employee
   */
  async createEmployee(data: CreateEmployeeInput): Promise<Employee> {
    console.log(`📝 Creating new employee: ${data.firstName} ${data.lastName}`);

    // Use user-provided employeeNumber if given, otherwise generate one
    const employeeNumber = data.employeeNumber || generateEmployeeNumber();
    const personId = `PER#${employeeNumber}`;
    const now = new Date().toISOString();

    const fullName = normalizeName(`${data.firstName} ${data.lastName}`);

    // Hash password if provided
    let passwordHash: string | undefined;
    if (data.password) {
      console.log(`🔐 Hashing password for ${fullName}`);
      passwordHash = await bcrypt.hash(data.password, 10);
    }

    const employee: Employee = {
      personId,
      employeeNumber, // Use exactly what the user provided or generated
      firstName: normalizeName(data.firstName),
      lastName: normalizeName(data.lastName),
      middleName: data.middleName ? normalizeName(data.middleName) : undefined,
      preferredName: data.preferredName ? normalizeName(data.preferredName) : undefined,
      fullName,
      email: data.email,
      phone: data.phone,
      hireDate: data.hireDate,
      employmentStatus: data.employmentStatus || 'active',
      hourlyRate: data.hourlyRate,
      overtimeRate: data.overtimeRate,
      jobTitle: data.jobTitle,
      knownAliases: [fullName],
      needsProfileCompletion: !data.email || !data.phone || !data.hireDate,
      createdByUserId: data.createdByUserId,
      // Authentication fields
      username: data.username,
      passwordHash,
      role: data.role,
      createdAt: now,
      updatedAt: now,
    };

    // Write main PROFILE record
    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: personId,
          SK: 'PROFILE',
          ...employee,
          full_name: fullName, // For GSI1-NameIndex
          employment_status: employee.employmentStatus, // For GSI3-StatusIndex
        },
      })
    );

    // Write alias record for full name
    await this.writeAliasRecord(personId, fullName);

    // Write alias for preferred name if different
    if (data.preferredName && data.preferredName !== fullName) {
      await this.addEmployeeAlias(personId, data.preferredName);
    }

    console.log(`✅ Employee created: ${fullName} (${personId})`);
    return employee;
  }

  // ==========================================================================
  // READ OPERATIONS
  // ==========================================================================

  /**
   * Get employee by person ID
   *
   * @param personId - Person ID (e.g., "PER#EMP-20250106001")
   * @returns Employee or null if not found
   */
  async getEmployeeById(personId: string): Promise<Employee | null> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            PK: personId,
            SK: 'PROFILE',
          },
        })
      );

      if (!result.Item) {
        return null;
      }

      return result.Item as Employee;
    } catch (error) {
      console.error(`❌ Error fetching employee ${personId}:`, error);
      return null;
    }
  }

  /**
   * Get employee by employee number
   *
   * @param employeeNumber - Employee number (e.g., "EMP-20250106001")
   * @returns Employee or null if not found
   */
  async getEmployeeByNumber(employeeNumber: string): Promise<Employee | null> {
    const personId = employeeNumber.startsWith('PER#')
      ? employeeNumber
      : `PER#${employeeNumber}`;
    return this.getEmployeeById(personId);
  }

  /**
   * Search employees by name (partial match)
   *
   * @param name - Name to search for
   * @returns Array of matching employees
   */
  async searchEmployeesByName(name: string): Promise<Employee[]> {
    const normalizedSearch = normalizeName(name).toLowerCase();

    try {
      // Scan all active employees and filter by name
      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'GSI3-StatusIndex',
          KeyConditionExpression: 'employment_status = :status',
          ExpressionAttributeValues: {
            ':status': 'active',
          },
        })
      );

      if (!result.Items || result.Items.length === 0) {
        return [];
      }

      // Filter by name match
      const matches = result.Items.filter((item) => {
        const employee = item as Employee;
        const fullNameMatch = employee.fullName.toLowerCase().includes(normalizedSearch);
        const firstNameMatch = employee.firstName.toLowerCase().includes(normalizedSearch);
        const lastNameMatch = employee.lastName.toLowerCase().includes(normalizedSearch);
        const aliasMatch = employee.knownAliases.some((alias) =>
          alias.toLowerCase().includes(normalizedSearch)
        );

        return fullNameMatch || firstNameMatch || lastNameMatch || aliasMatch;
      }) as Employee[];

      console.log(`🔍 Found ${matches.length} employees matching "${name}"`);
      return matches;
    } catch (error) {
      console.error(`❌ Error searching employees by name:`, error);
      return [];
    }
  }

  /**
   * List employees with optional filters
   *
   * @param filters - Optional filters
   * @returns Array of employees
   */
  async listEmployees(filters?: ListEmployeeFilters): Promise<Employee[]> {
    try {
      let result;

      if (filters?.status) {
        // Use GSI3-StatusIndex for status filtering
        result = await this.docClient.send(
          new QueryCommand({
            TableName: this.tableName,
            IndexName: 'GSI3-StatusIndex',
            KeyConditionExpression: 'employment_status = :status',
            ExpressionAttributeValues: {
              ':status': filters.status,
            },
          })
        );
      } else {
        // Scan for all employees with PROFILE SK
        result = await this.docClient.send(
          new ScanCommand({
            TableName: this.tableName,
            FilterExpression: 'SK = :sk',
            ExpressionAttributeValues: {
              ':sk': 'PROFILE',
            },
          })
        );
      }

      if (!result.Items || result.Items.length === 0) {
        return [];
      }

      let employees = result.Items as Employee[];

      // Apply additional filters
      if (filters?.needsProfileCompletion !== undefined) {
        employees = employees.filter(
          (emp) => emp.needsProfileCompletion === filters.needsProfileCompletion
        );
      }

      // Note: projectId filtering would require additional query or cross-reference
      // with work history records - not implemented in this basic version

      console.log(`📋 Listed ${employees.length} employees`);
      return employees;
    } catch (error) {
      console.error(`❌ Error listing employees:`, error);
      return [];
    }
  }

  // ==========================================================================
  // UPDATE OPERATIONS
  // ==========================================================================

  /**
   * Update employee record
   *
   * @param personId - Person ID
   * @param data - Partial employee data to update (password will be hashed if provided)
   * @returns Updated employee
   */
  async updateEmployee(personId: string, data: Partial<Employee> & { password?: string }): Promise<Employee> {
    console.log(`📝 Updating employee: ${personId}`);

    const now = new Date().toISOString();

    // Get current employee
    const current = await this.getEmployeeById(personId);
    if (!current) {
      throw new Error(`Employee ${personId} not found`);
    }

    // Hash password if provided
    if (data.password) {
      console.log(`🔐 Hashing new password for ${personId}`);
      data.passwordHash = await bcrypt.hash(data.password, 10);
      // Remove plain password from data
      delete data.password;
    }

    // Build update expression
    const updates: string[] = [];
    const values: Record<string, any> = { ':updatedAt': now };
    const names: Record<string, string> = {};

    // Update scalar fields
    const scalarFields = [
      'firstName',
      'lastName',
      'middleName',
      'preferredName',
      'employeeNumber',
      'email',
      'phone',
      'hireDate',
      'employmentStatus',
      'hourlyRate',
      'overtimeRate',
      'jobTitle',
      'lastSeenDate',
      'lastSeenProjectId',
      'needsProfileCompletion',
      // Authentication fields
      'username',
      'passwordHash',
      'role',
    ] as const;

    for (const field of scalarFields) {
      if (data[field] !== undefined) {
        updates.push(`#${field} = :${field}`);
        values[`:${field}`] = data[field];
        names[`#${field}`] = field;
      }
    }

    // Special handling for name changes - update fullName
    if (data.firstName || data.lastName) {
      const firstName = data.firstName || current.firstName;
      const lastName = data.lastName || current.lastName;
      const fullName = normalizeName(`${firstName} ${lastName}`);

      updates.push(`fullName = :fullName, full_name = :fullName`);
      values[':fullName'] = fullName;
    }

    updates.push(`updatedAt = :updatedAt`);

    await this.docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: personId,
          SK: 'PROFILE',
        },
        UpdateExpression: `SET ${updates.join(', ')}`,
        ExpressionAttributeValues: values,
        ExpressionAttributeNames: Object.keys(names).length > 0 ? names : undefined,
      })
    );

    // Fetch and return updated employee
    const updated = await this.getEmployeeById(personId);
    if (!updated) {
      throw new Error(`Failed to fetch updated employee ${personId}`);
    }

    console.log(`✅ Employee updated: ${personId}`);
    return updated;
  }

  /**
   * Add an alias to employee record
   *
   * @param personId - Person ID
   * @param alias - Alias to add (e.g., "Bob", "Bobby")
   */
  async addEmployeeAlias(personId: string, alias: string): Promise<void> {
    const normalizedAlias = normalizeName(alias);
    console.log(`🏷️ Adding alias "${normalizedAlias}" to ${personId}`);

    // Get current employee
    const employee = await this.getEmployeeById(personId);
    if (!employee) {
      throw new Error(`Employee ${personId} not found`);
    }

    // Check if alias already exists
    if (employee.knownAliases.includes(normalizedAlias)) {
      console.log(`⚠️ Alias "${normalizedAlias}" already exists for ${personId}`);
      return;
    }

    // Add alias to knownAliases array
    const updatedAliases = [...employee.knownAliases, normalizedAlias];

    await this.docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: personId,
          SK: 'PROFILE',
        },
        UpdateExpression: 'SET knownAliases = :aliases, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':aliases': updatedAliases,
          ':updatedAt': new Date().toISOString(),
        },
      })
    );

    // Write alias record for lookup
    await this.writeAliasRecord(personId, normalizedAlias);

    console.log(`✅ Alias added: ${normalizedAlias}`);
  }

  /**
   * Write an alias record for quick lookup
   * Creates a SK with pattern "ALIAS#{normalized_alias}"
   *
   * @param personId - Person ID
   * @param alias - Alias string
   */
  private async writeAliasRecord(personId: string, alias: string): Promise<void> {
    const aliasKey = generateAliasKey(alias);

    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: personId,
          SK: aliasKey,
          alias: normalizeName(alias),
          createdAt: new Date().toISOString(),
        },
      })
    );
  }

  // ==========================================================================
  // DELETE OPERATIONS (SOFT DELETE)
  // ==========================================================================

  /**
   * Terminate employee (soft delete - changes status to 'terminated')
   *
   * @param personId - Person ID
   * @param terminationDate - Optional termination date
   * @param reason - Optional termination reason
   */
  async terminateEmployee(personId: string, terminationDate?: string, reason?: string): Promise<void> {
    console.log(`🚫 Terminating employee: ${personId}`);

    const employee = await this.getEmployeeById(personId);
    if (!employee) {
      throw new Error(`Employee ${personId} not found`);
    }

    const updateExpression = [
      'employmentStatus = :status',
      'employment_status = :status',
      'updatedAt = :updatedAt',
    ];

    const values: Record<string, any> = {
      ':status': 'terminated',
      ':updatedAt': new Date().toISOString(),
    };

    if (terminationDate) {
      updateExpression.push('terminationDate = :terminationDate');
      values[':terminationDate'] = terminationDate;
    }

    if (reason) {
      updateExpression.push('terminationReason = :reason');
      values[':reason'] = reason;
    }

    await this.docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: personId,
          SK: 'PROFILE',
        },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeValues: values,
      })
    );

    console.log(`✅ Employee terminated: ${personId}`, terminationDate ? `on ${terminationDate}` : '');
  }

  // ==========================================================================
  // SMART 6-LAYER DEDUPLICATION
  // ==========================================================================

  /**
   * Match or create employee using 6-layer intelligent deduplication
   *
   * Matching Layers:
   * 1. Exact Full Name Match (GSI1-NameIndex)
   * 2. Alias Search (SK pattern "ALIAS#")
   * 3. Fuzzy Name Matching (Levenshtein distance ≤ 2)
   * 4. Context-Based (same project recent employees)
   * 5. Multiple Matches Detection (flag for manual review)
   * 6. Auto-Create New (with needs_profile_completion=true)
   *
   * @param name - Name from voice transcript (e.g., "Bob", "Bobby Smith")
   * @param context - Optional context for matching
   * @returns Match result with employee ID and confidence
   */
  async matchOrCreateEmployee(
    name: string,
    context?: MatchContext
  ): Promise<MatchResult> {
    console.log(`🔍 Matching employee: "${name}"`);

    const normalizedName = normalizeName(name);
    const parsedName = parseName(normalizedName);

    // LAYER 1: Exact Full Name Match
    const exactMatch = await this.exactNameMatch(normalizedName);
    if (exactMatch) {
      console.log(`✅ LAYER 1: Exact match found - ${exactMatch.fullName}`);
      return {
        employeeId: exactMatch.personId,
        confidence: 'exact',
        needsReview: false,
        matchedName: exactMatch.fullName,
        matchMethod: 'exact_name',
      };
    }

    // LAYER 2: Alias Search
    const aliasMatch = await this.aliasSearch(normalizedName);
    if (aliasMatch) {
      console.log(`✅ LAYER 2: Alias match found - ${aliasMatch.fullName}`);
      return {
        employeeId: aliasMatch.personId,
        confidence: 'high',
        needsReview: false,
        matchedName: aliasMatch.fullName,
        matchMethod: 'alias_match',
      };
    }

    // LAYER 3: Fuzzy Name Matching (Levenshtein distance ≤ 2)
    const fuzzyMatches = await this.fuzzyNameMatch(normalizedName);
    if (fuzzyMatches.length === 1) {
      const match = fuzzyMatches[0];
      console.log(
        `✅ LAYER 3: Fuzzy match found - ${match.employee.fullName} (confidence: ${match.similarity.toFixed(1)}%)`
      );
      return {
        employeeId: match.employee.personId,
        confidence: match.similarity > 90 ? 'high' : 'medium',
        needsReview: match.similarity < 85,
        matchedName: match.employee.fullName,
        matchMethod: 'fuzzy_match',
      };
    }

    // LAYER 4: Context-Based Matching (if project context provided)
    if (context?.projectId && fuzzyMatches.length > 1) {
      const contextMatch = await this.contextBasedMatch(fuzzyMatches, context.projectId);
      if (contextMatch) {
        console.log(`✅ LAYER 4: Context-based match - ${contextMatch.fullName}`);
        return {
          employeeId: contextMatch.personId,
          confidence: 'medium',
          needsReview: true,
          matchedName: contextMatch.fullName,
          matchMethod: 'context_match',
          suggestedMatches: fuzzyMatches.map((m) => ({
            employeeId: m.employee.personId,
            name: m.employee.fullName,
            reason: `${m.similarity.toFixed(1)}% name similarity`,
            confidence: m.similarity,
          })),
        };
      }
    }

    // LAYER 5: Multiple Matches Detection
    if (fuzzyMatches.length > 1) {
      console.log(`⚠️ LAYER 5: Multiple matches found - needs review`);
      // Create new employee but flag for review
      const newEmployee = await this.createAutoEmployee(normalizedName, parsedName, context);
      return {
        employeeId: newEmployee.personId,
        confidence: 'new_employee',
        needsReview: true,
        matchedName: newEmployee.fullName,
        matchMethod: 'multiple_matches_create_new',
        suggestedMatches: fuzzyMatches.map((m) => ({
          employeeId: m.employee.personId,
          name: m.employee.fullName,
          reason: `${m.similarity.toFixed(1)}% name similarity`,
          confidence: m.similarity,
        })),
      };
    }

    // LAYER 6: Auto-Create New Employee
    console.log(`✨ LAYER 6: No matches found - creating new employee`);
    const newEmployee = await this.createAutoEmployee(normalizedName, parsedName, context);
    return {
      employeeId: newEmployee.personId,
      confidence: 'new_employee',
      needsReview: false,
      matchedName: newEmployee.fullName,
      matchMethod: 'auto_created',
    };
  }

  /**
   * LAYER 1: Query by exact full name using GSI1-NameIndex
   */
  private async exactNameMatch(normalizedName: string): Promise<Employee | null> {
    try {
      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'GSI1-NameIndex',
          KeyConditionExpression: 'full_name = :name',
          ExpressionAttributeValues: {
            ':name': normalizedName,
          },
          Limit: 1,
        })
      );

      if (result.Items && result.Items.length > 0) {
        return result.Items[0] as Employee;
      }
      return null;
    } catch (error) {
      console.error('❌ Error in exact name match:', error);
      return null;
    }
  }

  /**
   * LAYER 2: Search for alias records with SK pattern "ALIAS#"
   */
  private async aliasSearch(normalizedName: string): Promise<Employee | null> {
    try {
      const aliasKey = generateAliasKey(normalizedName);

      // Scan for alias records (in production, consider using GSI for aliases)
      const result = await this.docClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: 'SK = :aliasKey',
          ExpressionAttributeValues: {
            ':aliasKey': aliasKey,
          },
          Limit: 1,
        })
      );

      if (result.Items && result.Items.length > 0) {
        const aliasRecord = result.Items[0];
        // Get the full employee profile
        return await this.getEmployeeById(aliasRecord.PK);
      }

      return null;
    } catch (error) {
      console.error('❌ Error in alias search:', error);
      return null;
    }
  }

  /**
   * LAYER 3: Fuzzy name matching using Levenshtein distance
   */
  private async fuzzyNameMatch(
    normalizedName: string
  ): Promise<Array<{ employee: Employee; similarity: number }>> {
    try {
      // Get all active employees
      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'GSI3-StatusIndex',
          KeyConditionExpression: 'employment_status = :status',
          ExpressionAttributeValues: {
            ':status': 'active',
          },
        })
      );

      if (!result.Items || result.Items.length === 0) {
        return [];
      }

      const matches: Array<{ employee: Employee; similarity: number }> = [];

      for (const item of result.Items) {
        const employee = item as Employee;

        // Check similarity with full name
        const fullNameSimilarity = calculateSimilarity(normalizedName, employee.fullName);

        // Check similarity with known aliases
        let bestAliasSimilarity = 0;
        for (const alias of employee.knownAliases) {
          const similarity = calculateSimilarity(normalizedName, alias);
          if (similarity > bestAliasSimilarity) {
            bestAliasSimilarity = similarity;
          }
        }

        const bestSimilarity = Math.max(fullNameSimilarity, bestAliasSimilarity);

        // Threshold: 85% similarity and Levenshtein distance ≤ 2
        const distance = levenshteinDistance(
          normalizedName.toLowerCase(),
          employee.fullName.toLowerCase()
        );

        if (bestSimilarity >= 85 || distance <= 2) {
          matches.push({ employee, similarity: bestSimilarity });
        }
      }

      // Sort by similarity (highest first)
      matches.sort((a, b) => b.similarity - a.similarity);

      return matches;
    } catch (error) {
      console.error('❌ Error in fuzzy name matching:', error);
      return [];
    }
  }

  /**
   * LAYER 4: Context-based matching (filter by recent project activity)
   */
  private async contextBasedMatch(
    candidates: Array<{ employee: Employee; similarity: number }>,
    projectId: string
  ): Promise<Employee | null> {
    // Filter candidates who recently worked on the same project
    const projectMatches = candidates.filter(
      (c) => c.employee.lastSeenProjectId === projectId
    );

    if (projectMatches.length === 1) {
      return projectMatches[0].employee;
    }

    // If multiple or none, return highest similarity
    return candidates.length > 0 ? candidates[0].employee : null;
  }

  /**
   * LAYER 6: Auto-create new employee from voice transcript mention
   */
  private async createAutoEmployee(
    normalizedName: string,
    parsedName: { firstName: string; lastName: string; middleName?: string },
    context?: MatchContext
  ): Promise<Employee> {
    const personId = `PER#${generateEmployeeNumber()}`;
    const now = new Date().toISOString();

    const employee: Employee = {
      personId,
      employeeNumber: personId.replace('PER#', ''),
      firstName: parsedName.firstName,
      lastName: parsedName.lastName,
      middleName: parsedName.middleName,
      fullName: normalizedName,
      employmentStatus: 'active',
      knownAliases: [normalizedName],
      needsProfileCompletion: true,
      firstMentionedDate: context?.reportDate || now,
      firstMentionedReportId: context?.reportId,
      lastSeenDate: context?.reportDate,
      createdAt: now,
      updatedAt: now,
    };

    // Write PROFILE record
    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: personId,
          SK: 'PROFILE',
          ...employee,
          full_name: normalizedName,
          employment_status: 'active',
        },
      })
    );

    // Write alias record
    await this.writeAliasRecord(personId, normalizedName);

    console.log(`✨ Auto-created employee: ${normalizedName} (${personId})`);
    return employee;
  }

  // ==========================================================================
  // MERGE OPERATIONS
  // ==========================================================================

  /**
   * Preview merge operation before executing
   *
   * @param personId1 - Primary employee ID (will be kept)
   * @param personId2 - Duplicate employee ID (will be merged into primary)
   * @returns Merge preview with conflicts
   */
  async suggestMerge(personId1: string, personId2: string): Promise<MergePreview> {
    console.log(`🔍 Previewing merge: ${personId1} + ${personId2}`);

    const primary = await this.getEmployeeById(personId1);
    const duplicate = await this.getEmployeeById(personId2);

    if (!primary || !duplicate) {
      throw new Error('One or both employees not found');
    }

    // Detect field conflicts
    const conflicts: Array<{
      field: string;
      primaryValue: any;
      duplicateValue: any;
    }> = [];

    const fieldsToCheck = [
      'email',
      'phone',
      'hireDate',
      'hourlyRate',
      'overtimeRate',
      'jobTitle',
    ] as const;

    for (const field of fieldsToCheck) {
      if (
        primary[field] &&
        duplicate[field] &&
        primary[field] !== duplicate[field]
      ) {
        conflicts.push({
          field,
          primaryValue: primary[field],
          duplicateValue: duplicate[field],
        });
      }
    }

    // Aliases to merge
    const aliasesToMerge = duplicate.knownAliases.filter(
      (alias) => !primary.knownAliases.includes(alias)
    );

    // Count history records to move (would need separate query in real implementation)
    const historyRecordsToMove = 0; // Placeholder

    return {
      primaryEmployee: primary,
      duplicateEmployee: duplicate,
      conflicts,
      aliasesToMerge,
      historyRecordsToMove,
    };
  }

  /**
   * Merge duplicate employee into primary employee
   *
   * @param primaryId - Primary employee ID (will be kept)
   * @param duplicateId - Duplicate employee ID (will be terminated)
   * @returns Updated primary employee
   */
  async mergeEmployees(primaryId: string, duplicateId: string): Promise<Employee> {
    console.log(`🔀 Merging employees: ${duplicateId} → ${primaryId}`);

    const primary = await this.getEmployeeById(primaryId);
    const duplicate = await this.getEmployeeById(duplicateId);

    if (!primary || !duplicate) {
      throw new Error('One or both employees not found');
    }

    // Merge aliases
    const mergedAliases = [...new Set([...primary.knownAliases, ...duplicate.knownAliases])];

    // Fill missing fields from duplicate
    const updates: Partial<Employee> = {
      knownAliases: mergedAliases,
    };

    if (!primary.email && duplicate.email) updates.email = duplicate.email;
    if (!primary.phone && duplicate.phone) updates.phone = duplicate.phone;
    if (!primary.hireDate && duplicate.hireDate) updates.hireDate = duplicate.hireDate;
    if (!primary.hourlyRate && duplicate.hourlyRate) updates.hourlyRate = duplicate.hourlyRate;
    if (!primary.overtimeRate && duplicate.overtimeRate)
      updates.overtimeRate = duplicate.overtimeRate;

    // Update primary employee
    await this.docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: primaryId,
          SK: 'PROFILE',
        },
        UpdateExpression: 'SET knownAliases = :aliases, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':aliases': mergedAliases,
          ':updatedAt': new Date().toISOString(),
        },
      })
    );

    // Write alias records for duplicate's aliases pointing to primary
    for (const alias of duplicate.knownAliases) {
      await this.writeAliasRecord(primaryId, alias);
    }

    // Terminate duplicate employee
    await this.terminateEmployee(duplicateId);

    console.log(`✅ Employees merged successfully`);

    // Return updated primary
    const updated = await this.getEmployeeById(primaryId);
    if (!updated) {
      throw new Error('Failed to fetch merged employee');
    }

    return updated;
  }
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const personnelService = new PersonnelService();

// Export types for external use
export type {
  Employee,
  CreateEmployeeInput,
  MatchContext,
  MatchResult,
  MergePreview,
  ListEmployeeFilters,
};
