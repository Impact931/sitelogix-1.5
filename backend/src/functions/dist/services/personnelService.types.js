"use strict";
/**
 * Personnel Service Type Definitions
 *
 * Centralized type definitions for the Personnel Service
 * Import these types in your application for type safety
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MergeConflictError = exports.DuplicateEmployeeError = exports.InvalidEmployeeDataError = exports.EmployeeNotFoundError = void 0;
exports.isEmployee = isEmployee;
exports.isValidConfidence = isValidConfidence;
exports.isValidEmploymentStatus = isValidEmploymentStatus;
/**
 * Error types for personnel service operations
 */
class EmployeeNotFoundError extends Error {
    constructor(employeeId) {
        super(`Employee not found: ${employeeId}`);
        this.name = 'EmployeeNotFoundError';
    }
}
exports.EmployeeNotFoundError = EmployeeNotFoundError;
class InvalidEmployeeDataError extends Error {
    constructor(message) {
        super(`Invalid employee data: ${message}`);
        this.name = 'InvalidEmployeeDataError';
    }
}
exports.InvalidEmployeeDataError = InvalidEmployeeDataError;
class DuplicateEmployeeError extends Error {
    constructor(message) {
        super(`Duplicate employee detected: ${message}`);
        this.name = 'DuplicateEmployeeError';
    }
}
exports.DuplicateEmployeeError = DuplicateEmployeeError;
class MergeConflictError extends Error {
    constructor(conflicts) {
        super(`Merge conflicts detected: ${conflicts.map((c) => c.field).join(', ')}`);
        this.name = 'MergeConflictError';
    }
}
exports.MergeConflictError = MergeConflictError;
/**
 * Type guard to check if an object is an Employee
 */
function isEmployee(obj) {
    return (obj &&
        typeof obj === 'object' &&
        typeof obj.personId === 'string' &&
        typeof obj.employeeNumber === 'string' &&
        typeof obj.firstName === 'string' &&
        typeof obj.lastName === 'string' &&
        typeof obj.fullName === 'string' &&
        ['active', 'inactive', 'terminated'].includes(obj.employmentStatus) &&
        Array.isArray(obj.knownAliases) &&
        typeof obj.needsProfileCompletion === 'boolean');
}
/**
 * Type guard to check if a confidence level is valid
 */
function isValidConfidence(value) {
    return ['exact', 'high', 'medium', 'new_employee'].includes(value);
}
/**
 * Type guard to check if an employment status is valid
 */
function isValidEmploymentStatus(value) {
    return ['active', 'inactive', 'terminated'].includes(value);
}
//# sourceMappingURL=personnelService.types.js.map