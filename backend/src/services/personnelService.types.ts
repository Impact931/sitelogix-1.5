/**
 * Personnel Service Type Definitions
 *
 * Centralized type definitions for the Personnel Service
 * Import these types in your application for type safety
 */

/**
 * Complete employee record
 */
export interface Employee {
  /** Unique person identifier (e.g., "PER#EMP-20250106001") */
  personId: string;

  /** Employee number without prefix (e.g., "EMP-20250106001") */
  employeeNumber: string;

  /** First name (normalized to title case) */
  firstName: string;

  /** Last name (normalized to title case) */
  lastName: string;

  /** Middle name (optional) */
  middleName?: string;

  /** Preferred name or nickname (e.g., "Bob" instead of "Robert") */
  preferredName?: string;

  /** Full name computed from first + last (normalized) */
  fullName: string;

  /** Email address */
  email?: string;

  /** Phone number */
  phone?: string;

  /** Hire date (ISO date string) */
  hireDate?: string;

  /** Current employment status */
  employmentStatus: EmploymentStatus;

  /** Hourly pay rate */
  hourlyRate?: number;

  /** Overtime pay rate (typically 1.5x hourly) */
  overtimeRate?: number;

  /** Current job title/position */
  jobTitle?: string;

  /** Array of known aliases and name variations */
  knownAliases: string[];

  /** Date first mentioned in a report (ISO string) */
  firstMentionedDate?: string;

  /** ID of first report mentioning this employee */
  firstMentionedReportId?: string;

  /** Date last seen in any report (ISO string) */
  lastSeenDate?: string;

  /** Last project where employee was seen */
  lastSeenProjectId?: string;

  /** Flag indicating profile needs completion (missing email/phone/hire date) */
  needsProfileCompletion: boolean;

  /** User ID who created this record */
  createdByUserId?: string;

  /** Record creation timestamp (ISO string) */
  createdAt: string;

  /** Record last update timestamp (ISO string) */
  updatedAt: string;
}

/**
 * Employment status enum
 */
export type EmploymentStatus = 'active' | 'inactive' | 'terminated';

/**
 * Input for creating a new employee
 */
export interface CreateEmployeeInput {
  /** First name (will be normalized) */
  firstName: string;

  /** Last name (will be normalized) */
  lastName: string;

  /** Middle name (optional) */
  middleName?: string;

  /** Preferred name (optional) */
  preferredName?: string;

  /** Email address */
  email?: string;

  /** Phone number */
  phone?: string;

  /** Hire date (ISO date string) */
  hireDate?: string;

  /** Employment status (defaults to 'active') */
  employmentStatus?: EmploymentStatus;

  /** Hourly pay rate */
  hourlyRate?: number;

  /** Overtime pay rate */
  overtimeRate?: number;

  /** Job title/position */
  jobTitle?: string;

  /** User ID creating this record */
  createdByUserId?: string;
}

/**
 * Context information for employee matching
 */
export interface MatchContext {
  /** Project ID where employee was mentioned */
  projectId?: string;

  /** Report date (ISO string) */
  reportDate?: string;

  /** Report ID where employee was mentioned */
  reportId?: string;
}

/**
 * Match confidence level
 */
export type MatchConfidence = 'exact' | 'high' | 'medium' | 'new_employee';

/**
 * Match method used to find employee
 */
export type MatchMethod =
  | 'exact_name'
  | 'alias_match'
  | 'fuzzy_match'
  | 'context_match'
  | 'multiple_matches_create_new'
  | 'auto_created';

/**
 * Suggested match for manual review
 */
export interface SuggestedMatch {
  /** Employee ID of suggested match */
  employeeId: string;

  /** Full name of suggested match */
  name: string;

  /** Reason for suggestion (e.g., "95.5% name similarity") */
  reason: string;

  /** Confidence score (0-100) */
  confidence: number;
}

/**
 * Result of employee matching operation
 */
export interface MatchResult {
  /** Matched or newly created employee ID */
  employeeId: string;

  /** Confidence level of the match */
  confidence: MatchConfidence;

  /** Whether manual review is recommended */
  needsReview: boolean;

  /** The matched employee's full name */
  matchedName?: string;

  /** Method used to find the match */
  matchMethod?: MatchMethod;

  /** Array of suggested matches when multiple candidates found */
  suggestedMatches?: SuggestedMatch[];
}

/**
 * Field conflict in merge preview
 */
export interface FieldConflict {
  /** Field name with conflict */
  field: string;

  /** Value from primary employee */
  primaryValue: any;

  /** Value from duplicate employee */
  duplicateValue: any;
}

/**
 * Preview of merge operation
 */
export interface MergePreview {
  /** Primary employee (will be kept) */
  primaryEmployee: Employee;

  /** Duplicate employee (will be merged and terminated) */
  duplicateEmployee: Employee;

  /** Array of field conflicts that need resolution */
  conflicts: FieldConflict[];

  /** Aliases from duplicate that will be added to primary */
  aliasesToMerge: string[];

  /** Number of history records to move (placeholder for future implementation) */
  historyRecordsToMove: number;
}

/**
 * Filters for listing employees
 */
export interface ListEmployeeFilters {
  /** Filter by employment status */
  status?: EmploymentStatus;

  /** Filter by project ID (requires additional implementation) */
  projectId?: string;

  /** Filter by profile completion status */
  needsProfileCompletion?: boolean;
}

/**
 * Parsed name components
 */
export interface ParsedName {
  /** First name */
  firstName: string;

  /** Last name */
  lastName: string;

  /** Middle name (optional) */
  middleName?: string;
}

/**
 * DynamoDB record structure for PROFILE
 */
export interface EmployeeProfileRecord extends Employee {
  /** Partition key */
  PK: string;

  /** Sort key (always "PROFILE" for employee records) */
  SK: 'PROFILE';

  /** Full name for GSI1-NameIndex */
  full_name: string;

  /** Employment status for GSI3-StatusIndex */
  employment_status: EmploymentStatus;
}

/**
 * DynamoDB record structure for ALIAS
 */
export interface EmployeeAliasRecord {
  /** Partition key (same as employee's PK) */
  PK: string;

  /** Sort key (format: "ALIAS#{normalized_alias}") */
  SK: string;

  /** The alias value */
  alias: string;

  /** When alias was created */
  createdAt: string;
}

/**
 * Error types for personnel service operations
 */
export class EmployeeNotFoundError extends Error {
  constructor(employeeId: string) {
    super(`Employee not found: ${employeeId}`);
    this.name = 'EmployeeNotFoundError';
  }
}

export class InvalidEmployeeDataError extends Error {
  constructor(message: string) {
    super(`Invalid employee data: ${message}`);
    this.name = 'InvalidEmployeeDataError';
  }
}

export class DuplicateEmployeeError extends Error {
  constructor(message: string) {
    super(`Duplicate employee detected: ${message}`);
    this.name = 'DuplicateEmployeeError';
  }
}

export class MergeConflictError extends Error {
  constructor(conflicts: FieldConflict[]) {
    super(`Merge conflicts detected: ${conflicts.map((c) => c.field).join(', ')}`);
    this.name = 'MergeConflictError';
  }
}

/**
 * Service configuration options
 */
export interface PersonnelServiceConfig {
  /** DynamoDB table name */
  tableName?: string;

  /** AWS region */
  region?: string;

  /** Levenshtein distance threshold for fuzzy matching */
  fuzzyMatchThreshold?: number;

  /** Minimum similarity percentage for fuzzy matching */
  minSimilarityPercentage?: number;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Statistics for personnel operations
 */
export interface PersonnelStatistics {
  /** Total number of employees */
  totalEmployees: number;

  /** Number of active employees */
  activeEmployees: number;

  /** Number of inactive employees */
  inactiveEmployees: number;

  /** Number of terminated employees */
  terminatedEmployees: number;

  /** Number of employees needing profile completion */
  incompleteProfiles: number;

  /** Average hourly rate */
  averageHourlyRate?: number;

  /** Most common job titles */
  topJobTitles?: Array<{ title: string; count: number }>;
}

/**
 * Batch operation result
 */
export interface BatchOperationResult<T> {
  /** Successfully processed items */
  successful: T[];

  /** Failed items with error messages */
  failed: Array<{ item: T; error: string }>;

  /** Total items processed */
  total: number;

  /** Success rate (0-100) */
  successRate: number;
}

/**
 * Type guard to check if an object is an Employee
 */
export function isEmployee(obj: any): obj is Employee {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.personId === 'string' &&
    typeof obj.employeeNumber === 'string' &&
    typeof obj.firstName === 'string' &&
    typeof obj.lastName === 'string' &&
    typeof obj.fullName === 'string' &&
    ['active', 'inactive', 'terminated'].includes(obj.employmentStatus) &&
    Array.isArray(obj.knownAliases) &&
    typeof obj.needsProfileCompletion === 'boolean'
  );
}

/**
 * Type guard to check if a confidence level is valid
 */
export function isValidConfidence(value: string): value is MatchConfidence {
  return ['exact', 'high', 'medium', 'new_employee'].includes(value);
}

/**
 * Type guard to check if an employment status is valid
 */
export function isValidEmploymentStatus(value: string): value is EmploymentStatus {
  return ['active', 'inactive', 'terminated'].includes(value);
}
