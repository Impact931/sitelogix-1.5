"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.payrollService = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
/**
 * Calculate total hours from regular, overtime, and double-time hours
 */
function calculateTotalHours(regular, overtime, doubleTime) {
    return regular + overtime + doubleTime;
}
/**
 * Calculate total labor cost with overtime multipliers
 * Regular: 1x, Overtime: 1.5x, Double Time: 2x
 */
function calculateTotalCost(regularHours, overtimeHours, doubleTimeHours, hourlyRate) {
    const regularCost = regularHours * hourlyRate;
    const overtimeCost = overtimeHours * (hourlyRate * 1.5);
    const doubleTimeCost = doubleTimeHours * (hourlyRate * 2.0);
    return Number((regularCost + overtimeCost + doubleTimeCost).toFixed(2));
}
/**
 * Generate unique entry ID
 * Format: PAY-timestamp-random
 */
function generateEntryId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return `PAY-${timestamp}-${random}`;
}
/**
 * Format date to YYYY-MM-DD
 */
function formatDate(date) {
    if (typeof date === 'string') {
        // Validate format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
            throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD`);
        }
        return date;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
/**
 * Escape CSV field (handle commas, quotes, newlines)
 */
function escapeCSVField(field) {
    if (field === undefined || field === null) {
        return '';
    }
    const value = String(field);
    // If field contains comma, quote, or newline, wrap in quotes and escape quotes
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}
/**
 * Convert payroll entry to CSV row
 */
function toCSVRow(entry) {
    const fields = [
        entry.report_date,
        entry.employee_number,
        entry.employee_name,
        entry.project_name,
        entry.regular_hours.toFixed(2),
        entry.overtime_hours.toFixed(2),
        entry.double_time_hours.toFixed(2),
        entry.total_hours.toFixed(2),
        entry.hourly_rate.toFixed(2),
        entry.total_cost.toFixed(2),
        entry.work_location,
        entry.employee_specific_issues || '',
    ];
    return fields.map(escapeCSVField).join(',');
}
/**
 * Validate payroll entry input
 */
function validatePayrollEntry(data) {
    const errors = [];
    // Required fields
    if (!data.report_id)
        errors.push('report_id is required');
    if (!data.report_date)
        errors.push('report_date is required');
    if (!data.project_id)
        errors.push('project_id is required');
    if (!data.project_name)
        errors.push('project_name is required');
    if (!data.employee_id)
        errors.push('employee_id is required');
    if (!data.employee_name)
        errors.push('employee_name is required');
    if (!data.employee_number)
        errors.push('employee_number is required');
    if (!data.work_location)
        errors.push('work_location is required');
    // Validate date format
    try {
        formatDate(data.report_date);
    }
    catch (error) {
        errors.push('report_date must be in YYYY-MM-DD format');
    }
    // Validate hours (must be non-negative)
    if (data.regular_hours < 0)
        errors.push('regular_hours must be non-negative');
    if (data.overtime_hours < 0)
        errors.push('overtime_hours must be non-negative');
    if (data.double_time_hours < 0)
        errors.push('double_time_hours must be non-negative');
    // Validate hourly rate
    if (data.hourly_rate <= 0)
        errors.push('hourly_rate must be greater than 0');
    // Validate work location
    if (!['on-site', 'off-site'].includes(data.work_location)) {
        errors.push('work_location must be "on-site" or "off-site"');
    }
    // Validate activities array
    if (!Array.isArray(data.activities_performed)) {
        errors.push('activities_performed must be an array');
    }
    if (errors.length > 0) {
        throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
}
/**
 * Generate Sort Key for payroll entry
 * Format: employee_id#timestamp
 */
function generateSortKey(employeeId, timestamp) {
    const ts = timestamp || Date.now();
    return `${employeeId}#${ts}`;
}
// ============================================================================
// PAYROLL SERVICE CLASS
// ============================================================================
class PayrollService {
    constructor() {
        this.tableName = 'sitelogix-payroll-entries';
        const client = new client_dynamodb_1.DynamoDBClient({
            region: process.env.AWS_REGION || 'us-east-1',
        });
        this.docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
    }
    // ==========================================================================
    // CREATE OPERATIONS
    // ==========================================================================
    /**
     * Create a single payroll entry
     */
    async createPayrollEntry(data) {
        console.log('💰 Creating payroll entry:', data.employee_name);
        // Validate input
        validatePayrollEntry(data);
        // Generate unique IDs
        const entry_id = generateEntryId();
        const timestamp = Date.now();
        const now = new Date().toISOString();
        // Calculate totals
        const total_hours = calculateTotalHours(data.regular_hours, data.overtime_hours, data.double_time_hours);
        const total_cost = calculateTotalCost(data.regular_hours, data.overtime_hours, data.double_time_hours, data.hourly_rate);
        // Build complete entry
        const entry = {
            entry_id,
            report_id: data.report_id,
            report_date: formatDate(data.report_date),
            report_submitted_by: data.report_submitted_by,
            project_id: data.project_id,
            project_name: data.project_name,
            employee_id: data.employee_id,
            employee_name: data.employee_name,
            employee_number: data.employee_number,
            regular_hours: data.regular_hours,
            overtime_hours: data.overtime_hours,
            double_time_hours: data.double_time_hours,
            total_hours,
            arrival_time: data.arrival_time,
            departure_time: data.departure_time,
            activities_performed: data.activities_performed,
            employee_specific_issues: data.employee_specific_issues,
            work_location: data.work_location,
            hourly_rate: data.hourly_rate,
            total_cost,
            extracted_by_ai: data.extracted_by_ai,
            needs_review: data.needs_review ?? false,
            created_at: now,
            updated_at: now,
        };
        // Generate partition key and sort key
        const sortKey = generateSortKey(data.employee_id, timestamp);
        // Store in DynamoDB
        const command = new lib_dynamodb_1.PutCommand({
            TableName: this.tableName,
            Item: {
                ...entry,
                PK: data.report_id,
                SK: sortKey,
            },
        });
        try {
            await this.docClient.send(command);
            console.log('✅ Payroll entry created:', entry_id);
            return entry;
        }
        catch (error) {
            console.error('❌ Error creating payroll entry:', error);
            throw new Error(`Failed to create payroll entry: ${error}`);
        }
    }
    /**
     * Create multiple payroll entries in batch
     * Uses BatchWriteCommand for efficiency (up to 25 items per batch)
     */
    async createBulkEntries(entries) {
        console.log(`💰 Creating ${entries.length} payroll entries in bulk`);
        if (entries.length === 0) {
            return [];
        }
        const createdEntries = [];
        const BATCH_SIZE = 25; // DynamoDB limit
        // Process in batches of 25
        for (let i = 0; i < entries.length; i += BATCH_SIZE) {
            const batch = entries.slice(i, i + BATCH_SIZE);
            const writeRequests = batch.map((data) => {
                // Validate each entry
                validatePayrollEntry(data);
                const entry_id = generateEntryId();
                const timestamp = Date.now();
                const now = new Date().toISOString();
                const total_hours = calculateTotalHours(data.regular_hours, data.overtime_hours, data.double_time_hours);
                const total_cost = calculateTotalCost(data.regular_hours, data.overtime_hours, data.double_time_hours, data.hourly_rate);
                const entry = {
                    entry_id,
                    report_id: data.report_id,
                    report_date: formatDate(data.report_date),
                    report_submitted_by: data.report_submitted_by,
                    project_id: data.project_id,
                    project_name: data.project_name,
                    employee_id: data.employee_id,
                    employee_name: data.employee_name,
                    employee_number: data.employee_number,
                    regular_hours: data.regular_hours,
                    overtime_hours: data.overtime_hours,
                    double_time_hours: data.double_time_hours,
                    total_hours,
                    arrival_time: data.arrival_time,
                    departure_time: data.departure_time,
                    activities_performed: data.activities_performed,
                    employee_specific_issues: data.employee_specific_issues,
                    work_location: data.work_location,
                    hourly_rate: data.hourly_rate,
                    total_cost,
                    extracted_by_ai: data.extracted_by_ai,
                    needs_review: data.needs_review ?? false,
                    created_at: now,
                    updated_at: now,
                };
                createdEntries.push(entry);
                const sortKey = generateSortKey(data.employee_id, timestamp);
                return {
                    PutRequest: {
                        Item: {
                            ...entry,
                            PK: data.report_id,
                            SK: sortKey,
                        },
                    },
                };
            });
            const command = new lib_dynamodb_1.BatchWriteCommand({
                RequestItems: {
                    [this.tableName]: writeRequests,
                },
            });
            try {
                await this.docClient.send(command);
                console.log(`✅ Batch ${i / BATCH_SIZE + 1} completed`);
            }
            catch (error) {
                console.error('❌ Error in batch write:', error);
                throw new Error(`Failed to create bulk entries: ${error}`);
            }
        }
        console.log(`✅ Created ${createdEntries.length} payroll entries`);
        return createdEntries;
    }
    // ==========================================================================
    // READ OPERATIONS
    // ==========================================================================
    /**
     * Get a single payroll entry by entry_id
     * Uses scan with filter (less efficient, but entry_id is unique)
     */
    async getEntryById(entryId) {
        console.log('🔍 Getting payroll entry:', entryId);
        // Since entry_id is not part of PK/SK, we need to query with a filter
        // This is less efficient but necessary for this access pattern
        const command = new lib_dynamodb_1.QueryCommand({
            TableName: this.tableName,
            FilterExpression: 'entry_id = :entryId',
            ExpressionAttributeValues: {
                ':entryId': entryId,
            },
        });
        try {
            const response = await this.docClient.send(command);
            if (!response.Items || response.Items.length === 0) {
                console.log('⚠️ Entry not found:', entryId);
                return null;
            }
            return response.Items[0];
        }
        catch (error) {
            console.error('❌ Error getting entry:', error);
            throw new Error(`Failed to get entry: ${error}`);
        }
    }
    /**
     * Get all payroll entries for a specific report
     * Uses primary key query (report_id)
     */
    async getEntriesByReport(reportId) {
        console.log('🔍 Getting payroll entries for report:', reportId);
        const command = new lib_dynamodb_1.QueryCommand({
            TableName: this.tableName,
            KeyConditionExpression: 'PK = :reportId',
            ExpressionAttributeValues: {
                ':reportId': reportId,
            },
        });
        try {
            const response = await this.docClient.send(command);
            return (response.Items || []);
        }
        catch (error) {
            console.error('❌ Error getting entries by report:', error);
            throw new Error(`Failed to get entries by report: ${error}`);
        }
    }
    /**
     * Get all payroll entries for an employee within a date range
     * Uses GSI1-EmployeeDateIndex
     */
    async getEntriesByEmployee(employeeId, startDate, endDate) {
        console.log(`🔍 Getting entries for employee ${employeeId} from ${startDate} to ${endDate}`);
        const command = new lib_dynamodb_1.QueryCommand({
            TableName: this.tableName,
            IndexName: 'GSI1-EmployeeDateIndex',
            KeyConditionExpression: 'employee_id = :employeeId AND report_date BETWEEN :startDate AND :endDate',
            ExpressionAttributeValues: {
                ':employeeId': employeeId,
                ':startDate': formatDate(startDate),
                ':endDate': formatDate(endDate),
            },
        });
        try {
            const response = await this.docClient.send(command);
            return (response.Items || []);
        }
        catch (error) {
            console.error('❌ Error getting entries by employee:', error);
            throw new Error(`Failed to get entries by employee: ${error}`);
        }
    }
    /**
     * Get all payroll entries for a project within a date range
     * Uses GSI2-ProjectDateIndex
     */
    async getEntriesByProject(projectId, startDate, endDate) {
        console.log(`🔍 Getting entries for project ${projectId} from ${startDate} to ${endDate}`);
        const command = new lib_dynamodb_1.QueryCommand({
            TableName: this.tableName,
            IndexName: 'GSI2-ProjectDateIndex',
            KeyConditionExpression: 'project_id = :projectId AND report_date BETWEEN :startDate AND :endDate',
            ExpressionAttributeValues: {
                ':projectId': projectId,
                ':startDate': formatDate(startDate),
                ':endDate': formatDate(endDate),
            },
        });
        try {
            const response = await this.docClient.send(command);
            return (response.Items || []);
        }
        catch (error) {
            console.error('❌ Error getting entries by project:', error);
            throw new Error(`Failed to get entries by project: ${error}`);
        }
    }
    /**
     * Get all payroll entries for a specific date
     * Uses GSI3-DateIndex
     */
    async getEntriesByDate(date) {
        console.log('🔍 Getting payroll entries for date:', date);
        const command = new lib_dynamodb_1.QueryCommand({
            TableName: this.tableName,
            IndexName: 'GSI3-DateIndex',
            KeyConditionExpression: 'report_date = :date',
            ExpressionAttributeValues: {
                ':date': formatDate(date),
            },
        });
        try {
            const response = await this.docClient.send(command);
            return (response.Items || []);
        }
        catch (error) {
            console.error('❌ Error getting entries by date:', error);
            throw new Error(`Failed to get entries by date: ${error}`);
        }
    }
    /**
     * Get all payroll entries that need review
     * Uses GSI4-ReviewIndex
     */
    async getEntriesNeedingReview() {
        console.log('🔍 Getting payroll entries needing review');
        const command = new lib_dynamodb_1.QueryCommand({
            TableName: this.tableName,
            IndexName: 'GSI4-ReviewIndex',
            KeyConditionExpression: 'needs_review = :needsReview',
            ExpressionAttributeValues: {
                ':needsReview': true,
            },
        });
        try {
            const response = await this.docClient.send(command);
            return (response.Items || []);
        }
        catch (error) {
            console.error('❌ Error getting entries needing review:', error);
            throw new Error(`Failed to get entries needing review: ${error}`);
        }
    }
    // ==========================================================================
    // UPDATE OPERATIONS
    // ==========================================================================
    /**
     * Update a payroll entry
     * Note: We need to find the entry first to get PK and SK
     */
    async updatePayrollEntry(entryId, data) {
        console.log('📝 Updating payroll entry:', entryId);
        // First, get the existing entry to obtain PK and SK
        const existingEntry = await this.getEntryById(entryId);
        if (!existingEntry) {
            throw new Error(`Entry not found: ${entryId}`);
        }
        // Build update expression dynamically
        const updateExpressions = [];
        const attributeNames = {};
        const attributeValues = {};
        // Track if hours or rate changed (need to recalculate totals)
        const hoursOrRateChanged = data.regular_hours !== undefined ||
            data.overtime_hours !== undefined ||
            data.double_time_hours !== undefined ||
            data.hourly_rate !== undefined;
        // Add updated_at
        data.updated_at = new Date().toISOString();
        // Build update expression
        Object.keys(data).forEach((key) => {
            if (key !== 'entry_id' && key !== 'PK' && key !== 'SK') {
                updateExpressions.push(`#${key} = :${key}`);
                attributeNames[`#${key}`] = key;
                attributeValues[`:${key}`] = data[key];
            }
        });
        // Recalculate totals if needed
        if (hoursOrRateChanged) {
            const regular = data.regular_hours ?? existingEntry.regular_hours;
            const overtime = data.overtime_hours ?? existingEntry.overtime_hours;
            const doubleTime = data.double_time_hours ?? existingEntry.double_time_hours;
            const rate = data.hourly_rate ?? existingEntry.hourly_rate;
            const total_hours = calculateTotalHours(regular, overtime, doubleTime);
            const total_cost = calculateTotalCost(regular, overtime, doubleTime, rate);
            updateExpressions.push('#total_hours = :total_hours');
            updateExpressions.push('#total_cost = :total_cost');
            attributeNames['#total_hours'] = 'total_hours';
            attributeNames['#total_cost'] = 'total_cost';
            attributeValues[':total_hours'] = total_hours;
            attributeValues[':total_cost'] = total_cost;
        }
        // We need PK and SK from the existing entry
        // Reconstruct them from the stored values
        const command = new lib_dynamodb_1.UpdateCommand({
            TableName: this.tableName,
            Key: {
                PK: existingEntry.report_id,
                SK: `${existingEntry.employee_id}#${new Date(existingEntry.created_at).getTime()}`,
            },
            UpdateExpression: `SET ${updateExpressions.join(', ')}`,
            ExpressionAttributeNames: attributeNames,
            ExpressionAttributeValues: attributeValues,
            ReturnValues: 'ALL_NEW',
        });
        try {
            const response = await this.docClient.send(command);
            console.log('✅ Payroll entry updated');
            return response.Attributes;
        }
        catch (error) {
            console.error('❌ Error updating entry:', error);
            throw new Error(`Failed to update entry: ${error}`);
        }
    }
    /**
     * Mark an entry as reviewed
     */
    async markAsReviewed(entryId) {
        console.log('✅ Marking entry as reviewed:', entryId);
        await this.updatePayrollEntry(entryId, { needs_review: false });
    }
    // ==========================================================================
    // DELETE OPERATIONS
    // ==========================================================================
    /**
     * Delete a payroll entry
     */
    async deletePayrollEntry(entryId) {
        console.log('🗑️ Deleting payroll entry:', entryId);
        // Get the entry to obtain PK and SK
        const entry = await this.getEntryById(entryId);
        if (!entry) {
            throw new Error(`Entry not found: ${entryId}`);
        }
        const command = new lib_dynamodb_1.DeleteCommand({
            TableName: this.tableName,
            Key: {
                PK: entry.report_id,
                SK: `${entry.employee_id}#${new Date(entry.created_at).getTime()}`,
            },
        });
        try {
            await this.docClient.send(command);
            console.log('✅ Payroll entry deleted');
        }
        catch (error) {
            console.error('❌ Error deleting entry:', error);
            throw new Error(`Failed to delete entry: ${error}`);
        }
    }
    // ==========================================================================
    // AGGREGATION & REPORTING
    // ==========================================================================
    /**
     * Generate daily payroll report with aggregated data
     * Queries all entries for a specific date and aggregates by employee
     */
    async generateDailyPayrollReport(date) {
        console.log('📊 Generating daily payroll report for:', date);
        // Get all entries for the date using GSI3-DateIndex
        const entries = await this.getEntriesByDate(date);
        if (entries.length === 0) {
            return {
                date: formatDate(date),
                totalEmployees: 0,
                totalRegularHours: 0,
                totalOvertimeHours: 0,
                totalDoubleTimeHours: 0,
                totalHours: 0,
                totalCost: 0,
                entries: [],
            };
        }
        // Aggregate totals
        let totalRegularHours = 0;
        let totalOvertimeHours = 0;
        let totalDoubleTimeHours = 0;
        let totalHours = 0;
        let totalCost = 0;
        // Track unique employees
        const employeeSet = new Set();
        // Map entries for report
        const reportEntries = entries.map((entry) => {
            employeeSet.add(entry.employee_id);
            totalRegularHours += entry.regular_hours;
            totalOvertimeHours += entry.overtime_hours;
            totalDoubleTimeHours += entry.double_time_hours;
            totalHours += entry.total_hours;
            totalCost += entry.total_cost;
            return {
                employeeNumber: entry.employee_number,
                employeeName: entry.employee_name,
                projectName: entry.project_name,
                regularHours: entry.regular_hours,
                overtimeHours: entry.overtime_hours,
                doubleTimeHours: entry.double_time_hours,
                totalHours: entry.total_hours,
                hourlyRate: entry.hourly_rate,
                totalCost: entry.total_cost,
                workLocation: entry.work_location,
                issues: entry.employee_specific_issues,
            };
        });
        const report = {
            date: formatDate(date),
            totalEmployees: employeeSet.size,
            totalRegularHours: Number(totalRegularHours.toFixed(2)),
            totalOvertimeHours: Number(totalOvertimeHours.toFixed(2)),
            totalDoubleTimeHours: Number(totalDoubleTimeHours.toFixed(2)),
            totalHours: Number(totalHours.toFixed(2)),
            totalCost: Number(totalCost.toFixed(2)),
            entries: reportEntries,
        };
        console.log(`✅ Generated report: ${report.totalEmployees} employees, ${report.totalHours} hours, $${report.totalCost}`);
        return report;
    }
    /**
     * Get employee timesheet for a date range
     * Aggregates all work done by a specific employee
     */
    async getEmployeeTimesheet(employeeId, startDate, endDate) {
        console.log(`📊 Generating timesheet for employee ${employeeId} from ${startDate} to ${endDate}`);
        // Get all entries for employee in date range using GSI1
        const entries = await this.getEntriesByEmployee(employeeId, startDate, endDate);
        if (entries.length === 0) {
            throw new Error(`No timesheet entries found for employee: ${employeeId}`);
        }
        // Aggregate totals
        let totalRegularHours = 0;
        let totalOvertimeHours = 0;
        let totalDoubleTimeHours = 0;
        let totalHours = 0;
        let totalCost = 0;
        // Get employee info from first entry
        const { employee_name, employee_number } = entries[0];
        // Map daily entries
        const dailyEntries = entries.map((entry) => {
            totalRegularHours += entry.regular_hours;
            totalOvertimeHours += entry.overtime_hours;
            totalDoubleTimeHours += entry.double_time_hours;
            totalHours += entry.total_hours;
            totalCost += entry.total_cost;
            return {
                date: entry.report_date,
                projectName: entry.project_name,
                regularHours: entry.regular_hours,
                overtimeHours: entry.overtime_hours,
                doubleTimeHours: entry.double_time_hours,
                totalHours: entry.total_hours,
                totalCost: entry.total_cost,
                issues: entry.employee_specific_issues,
            };
        });
        // Sort by date
        dailyEntries.sort((a, b) => a.date.localeCompare(b.date));
        const timesheet = {
            employeeId,
            employeeName: employee_name,
            employeeNumber: employee_number,
            startDate: formatDate(startDate),
            endDate: formatDate(endDate),
            totalRegularHours: Number(totalRegularHours.toFixed(2)),
            totalOvertimeHours: Number(totalOvertimeHours.toFixed(2)),
            totalDoubleTimeHours: Number(totalDoubleTimeHours.toFixed(2)),
            totalHours: Number(totalHours.toFixed(2)),
            totalCost: Number(totalCost.toFixed(2)),
            dailyEntries,
        };
        console.log(`✅ Timesheet generated: ${timesheet.totalHours} hours, $${timesheet.totalCost}`);
        return timesheet;
    }
    /**
     * Get project labor costs for a date range
     * Aggregates all labor costs for a specific project
     */
    async getProjectLaborCosts(projectId, startDate, endDate) {
        console.log(`📊 Generating labor costs for project ${projectId} from ${startDate} to ${endDate}`);
        // Get all entries for project in date range using GSI2
        const entries = await this.getEntriesByProject(projectId, startDate, endDate);
        if (entries.length === 0) {
            throw new Error(`No labor entries found for project: ${projectId}`);
        }
        // Aggregate totals
        let totalRegularHours = 0;
        let totalOvertimeHours = 0;
        let totalDoubleTimeHours = 0;
        let totalHours = 0;
        let totalCost = 0;
        // Track unique employees
        const employeeSet = new Set();
        // Get project name from first entry
        const { project_name } = entries[0];
        // Group by date for daily breakdown
        const dailyMap = new Map();
        entries.forEach((entry) => {
            employeeSet.add(entry.employee_id);
            totalRegularHours += entry.regular_hours;
            totalOvertimeHours += entry.overtime_hours;
            totalDoubleTimeHours += entry.double_time_hours;
            totalHours += entry.total_hours;
            totalCost += entry.total_cost;
            // Aggregate by date
            const dateKey = entry.report_date;
            if (!dailyMap.has(dateKey)) {
                dailyMap.set(dateKey, {
                    employees: new Set(),
                    regularHours: 0,
                    overtimeHours: 0,
                    doubleTimeHours: 0,
                    totalHours: 0,
                    totalCost: 0,
                });
            }
            const daily = dailyMap.get(dateKey);
            daily.employees.add(entry.employee_id);
            daily.regularHours += entry.regular_hours;
            daily.overtimeHours += entry.overtime_hours;
            daily.doubleTimeHours += entry.double_time_hours;
            daily.totalHours += entry.total_hours;
            daily.totalCost += entry.total_cost;
        });
        // Build daily breakdown
        const dailyBreakdown = Array.from(dailyMap.entries())
            .map(([date, data]) => ({
            date,
            employeeCount: data.employees.size,
            regularHours: Number(data.regularHours.toFixed(2)),
            overtimeHours: Number(data.overtimeHours.toFixed(2)),
            doubleTimeHours: Number(data.doubleTimeHours.toFixed(2)),
            totalHours: Number(data.totalHours.toFixed(2)),
            totalCost: Number(data.totalCost.toFixed(2)),
        }))
            .sort((a, b) => a.date.localeCompare(b.date));
        const laborCosts = {
            projectId,
            projectName: project_name,
            startDate: formatDate(startDate),
            endDate: formatDate(endDate),
            totalRegularHours: Number(totalRegularHours.toFixed(2)),
            totalOvertimeHours: Number(totalOvertimeHours.toFixed(2)),
            totalDoubleTimeHours: Number(totalDoubleTimeHours.toFixed(2)),
            totalHours: Number(totalHours.toFixed(2)),
            totalCost: Number(totalCost.toFixed(2)),
            uniqueEmployees: employeeSet.size,
            dailyBreakdown,
        };
        console.log(`✅ Labor costs calculated: ${laborCosts.uniqueEmployees} employees, ${laborCosts.totalHours} hours, $${laborCosts.totalCost}`);
        return laborCosts;
    }
    // ==========================================================================
    // CSV EXPORT
    // ==========================================================================
    /**
     * Export daily payroll report as CSV
     * Format: Date, Employee #, Employee Name, Project, Regular Hrs, OT Hrs, DT Hrs, Total Hrs, Hourly Rate, Total Cost, Work Location, Issues
     */
    async exportDailyPayrollCSV(date) {
        console.log('📄 Exporting daily payroll CSV for:', date);
        // Generate daily report
        const report = await this.generateDailyPayrollReport(date);
        // CSV header
        const headers = [
            'Date',
            'Employee #',
            'Employee Name',
            'Project',
            'Regular Hrs',
            'OT Hrs',
            'DT Hrs',
            'Total Hrs',
            'Hourly Rate',
            'Total Cost',
            'Work Location',
            'Issues',
        ];
        const csvRows = [headers.join(',')];
        // Add data rows
        report.entries.forEach((entry) => {
            const row = [
                report.date,
                entry.employeeNumber,
                entry.employeeName,
                entry.projectName,
                entry.regularHours.toFixed(2),
                entry.overtimeHours.toFixed(2),
                entry.doubleTimeHours.toFixed(2),
                entry.totalHours.toFixed(2),
                entry.hourlyRate.toFixed(2),
                entry.totalCost.toFixed(2),
                entry.workLocation,
                entry.issues || '',
            ];
            csvRows.push(row.map(escapeCSVField).join(','));
        });
        // Add summary row
        csvRows.push(''); // Empty line
        csvRows.push([
            'TOTAL',
            '',
            `${report.totalEmployees} employees`,
            '',
            report.totalRegularHours.toFixed(2),
            report.totalOvertimeHours.toFixed(2),
            report.totalDoubleTimeHours.toFixed(2),
            report.totalHours.toFixed(2),
            '',
            report.totalCost.toFixed(2),
            '',
            '',
        ]
            .map(escapeCSVField)
            .join(','));
        const csv = csvRows.join('\n');
        console.log(`✅ CSV exported: ${csvRows.length - 2} entries`);
        return csv;
    }
    /**
     * Export employee timesheet as CSV
     */
    async exportEmployeeTimesheetCSV(employeeId, startDate, endDate) {
        console.log(`📄 Exporting employee timesheet CSV for ${employeeId} from ${startDate} to ${endDate}`);
        const timesheet = await this.getEmployeeTimesheet(employeeId, startDate, endDate);
        // CSV header
        const headers = [
            'Employee #',
            'Employee Name',
            'Date',
            'Project',
            'Regular Hrs',
            'OT Hrs',
            'DT Hrs',
            'Total Hrs',
            'Total Cost',
            'Issues',
        ];
        const csvRows = [headers.join(',')];
        // Add data rows
        timesheet.dailyEntries.forEach((entry) => {
            const row = [
                timesheet.employeeNumber,
                timesheet.employeeName,
                entry.date,
                entry.projectName,
                entry.regularHours.toFixed(2),
                entry.overtimeHours.toFixed(2),
                entry.doubleTimeHours.toFixed(2),
                entry.totalHours.toFixed(2),
                entry.totalCost.toFixed(2),
                entry.issues || '',
            ];
            csvRows.push(row.map(escapeCSVField).join(','));
        });
        // Add summary row
        csvRows.push(''); // Empty line
        csvRows.push([
            '',
            'TOTAL',
            `${timesheet.startDate} to ${timesheet.endDate}`,
            '',
            timesheet.totalRegularHours.toFixed(2),
            timesheet.totalOvertimeHours.toFixed(2),
            timesheet.totalDoubleTimeHours.toFixed(2),
            timesheet.totalHours.toFixed(2),
            timesheet.totalCost.toFixed(2),
            '',
        ]
            .map(escapeCSVField)
            .join(','));
        const csv = csvRows.join('\n');
        console.log(`✅ Timesheet CSV exported: ${timesheet.dailyEntries.length} entries`);
        return csv;
    }
    /**
     * Export project labor costs as CSV
     */
    async exportProjectLaborCostsCSV(projectId, startDate, endDate) {
        console.log(`📄 Exporting project labor costs CSV for ${projectId} from ${startDate} to ${endDate}`);
        const laborCosts = await this.getProjectLaborCosts(projectId, startDate, endDate);
        // CSV header
        const headers = [
            'Project',
            'Date',
            'Employee Count',
            'Regular Hrs',
            'OT Hrs',
            'DT Hrs',
            'Total Hrs',
            'Total Cost',
        ];
        const csvRows = [headers.join(',')];
        // Add data rows
        laborCosts.dailyBreakdown.forEach((daily) => {
            const row = [
                laborCosts.projectName,
                daily.date,
                daily.employeeCount.toString(),
                daily.regularHours.toFixed(2),
                daily.overtimeHours.toFixed(2),
                daily.doubleTimeHours.toFixed(2),
                daily.totalHours.toFixed(2),
                daily.totalCost.toFixed(2),
            ];
            csvRows.push(row.map(escapeCSVField).join(','));
        });
        // Add summary row
        csvRows.push(''); // Empty line
        csvRows.push([
            'TOTAL',
            `${laborCosts.startDate} to ${laborCosts.endDate}`,
            `${laborCosts.uniqueEmployees} unique employees`,
            laborCosts.totalRegularHours.toFixed(2),
            laborCosts.totalOvertimeHours.toFixed(2),
            laborCosts.totalDoubleTimeHours.toFixed(2),
            laborCosts.totalHours.toFixed(2),
            laborCosts.totalCost.toFixed(2),
        ]
            .map(escapeCSVField)
            .join(','));
        const csv = csvRows.join('\n');
        console.log(`✅ Project labor costs CSV exported: ${laborCosts.dailyBreakdown.length} days`);
        return csv;
    }
}
// ============================================================================
// EXPORT SINGLETON
// ============================================================================
exports.payrollService = new PayrollService();
