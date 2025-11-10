/**
 * Payroll API Endpoints
 * Handles payroll entry management and reporting using PayrollService
 */

const payrollService = require('./payrollService');

/**
 * POST /api/payroll
 * Create a single payroll entry
 */
async function handleCreatePayrollEntry(event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const {
      reportId,
      employeeId,
      employeeNumber,
      employeeName,
      projectId,
      projectName,
      reportDate,
      regularHours,
      overtimeHours,
      doubleTimeHours,
      hourlyRate,
      overtimeRate,
      doubleTimeRate,
      arrivalTime,
      departureTime,
      activities,
      employeeSpecificIssues
    } = body;

    // Validate required fields
    if (!reportId || !employeeId || !reportDate) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'Missing required fields: reportId, employeeId, reportDate',
          code: 'MISSING_FIELDS'
        }
      };
    }

    console.log(`➕ Creating payroll entry for employee ${employeeId} on ${reportDate}`);

    const entryData = {
      report_id: reportId,
      employee_id: employeeId,
      employee_number: employeeNumber,
      employee_name: employeeName,
      project_id: projectId,
      project_name: projectName,
      report_date: reportDate,
      regular_hours: regularHours || 0,
      overtime_hours: overtimeHours || 0,
      double_time_hours: doubleTimeHours || 0,
      hourly_rate: hourlyRate,
      overtime_rate: overtimeRate,
      double_time_rate: doubleTimeRate,
      arrival_time: arrivalTime,
      departure_time: departureTime,
      activities,
      employee_specific_issues: employeeSpecificIssues
    };

    const entryId = await payrollService.createPayrollEntry(entryData);

    return {
      statusCode: 201,
      body: {
        success: true,
        data: {
          entryId,
          message: 'Payroll entry created successfully'
        }
      }
    };
  } catch (error) {
    console.error('Error in handleCreatePayrollEntry:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: error.message,
        code: 'CREATE_ERROR'
      }
    };
  }
}

/**
 * POST /api/payroll/bulk
 * Create multiple payroll entries at once
 */
async function handleCreateBulkPayrollEntries(event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { entries } = body;

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'Missing or invalid entries array',
          code: 'INVALID_ENTRIES'
        }
      };
    }

    console.log(`➕ Creating ${entries.length} payroll entries in bulk`);

    // Convert camelCase to snake_case for each entry
    const formattedEntries = entries.map(entry => ({
      report_id: entry.reportId,
      employee_id: entry.employeeId,
      employee_number: entry.employeeNumber,
      employee_name: entry.employeeName,
      project_id: entry.projectId,
      project_name: entry.projectName,
      report_date: entry.reportDate,
      regular_hours: entry.regularHours || 0,
      overtime_hours: entry.overtimeHours || 0,
      double_time_hours: entry.doubleTimeHours || 0,
      hourly_rate: entry.hourlyRate,
      overtime_rate: entry.overtimeRate,
      double_time_rate: entry.doubleTimeRate,
      arrival_time: entry.arrivalTime,
      departure_time: entry.departureTime,
      activities: entry.activities,
      employee_specific_issues: entry.employeeSpecificIssues
    }));

    const result = await payrollService.createBulkEntries(formattedEntries);

    return {
      statusCode: 201,
      body: {
        success: true,
        data: {
          created: result.successful.length,
          failed: result.failed.length,
          successful: result.successful,
          failed: result.failed
        }
      }
    };
  } catch (error) {
    console.error('Error in handleCreateBulkPayrollEntries:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: error.message,
        code: 'BULK_CREATE_ERROR'
      }
    };
  }
}

/**
 * GET /api/payroll/:id
 * Get a payroll entry by ID
 */
async function handleGetPayrollEntry(event, entryId) {
  try {
    console.log(`🔍 Fetching payroll entry: ${entryId}`);

    const entry = await payrollService.getEntryById(entryId);

    if (!entry) {
      return {
        statusCode: 404,
        body: {
          success: false,
          error: 'Payroll entry not found',
          code: 'NOT_FOUND'
        }
      };
    }

    return {
      statusCode: 200,
      body: {
        success: true,
        data: entry
      }
    };
  } catch (error) {
    console.error('Error in handleGetPayrollEntry:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: error.message,
        code: 'FETCH_ERROR'
      }
    };
  }
}

/**
 * GET /api/payroll/report/:reportId
 * Get all payroll entries for a report
 */
async function handleGetPayrollByReport(event, reportId) {
  try {
    console.log(`📋 Fetching payroll entries for report: ${reportId}`);

    const entries = await payrollService.getEntriesByReport(reportId);

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          entries,
          count: entries.length
        }
      }
    };
  } catch (error) {
    console.error('Error in handleGetPayrollByReport:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: error.message,
        code: 'FETCH_ERROR'
      }
    };
  }
}

/**
 * GET /api/payroll/employee/:employeeId
 * Get all payroll entries for an employee
 */
async function handleGetPayrollByEmployee(event, employeeId) {
  try {
    const queryParams = event.queryStringParameters || {};
    const { startDate, endDate } = queryParams;

    console.log(`📋 Fetching payroll entries for employee: ${employeeId}`);

    const entries = await payrollService.getEntriesByEmployee(employeeId, startDate, endDate);

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          entries,
          count: entries.length
        }
      }
    };
  } catch (error) {
    console.error('Error in handleGetPayrollByEmployee:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: error.message,
        code: 'FETCH_ERROR'
      }
    };
  }
}

/**
 * GET /api/payroll/project/:projectId
 * Get all payroll entries for a project
 */
async function handleGetPayrollByProject(event, projectId) {
  try {
    const queryParams = event.queryStringParameters || {};
    const { startDate, endDate } = queryParams;

    console.log(`📋 Fetching payroll entries for project: ${projectId}`);

    const entries = await payrollService.getEntriesByProject(projectId, startDate, endDate);

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          entries,
          count: entries.length
        }
      }
    };
  } catch (error) {
    console.error('Error in handleGetPayrollByProject:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: error.message,
        code: 'FETCH_ERROR'
      }
    };
  }
}

/**
 * GET /api/payroll/date/:date
 * Get all payroll entries for a specific date
 */
async function handleGetPayrollByDate(event, date) {
  try {
    console.log(`📋 Fetching payroll entries for date: ${date}`);

    const entries = await payrollService.getEntriesByDate(date);

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          entries,
          count: entries.length
        }
      }
    };
  } catch (error) {
    console.error('Error in handleGetPayrollByDate:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: error.message,
        code: 'FETCH_ERROR'
      }
    };
  }
}

/**
 * GET /api/payroll/review
 * Get all entries that need review
 */
async function handleGetPayrollNeedingReview(event) {
  try {
    console.log(`🔍 Fetching payroll entries needing review`);

    const entries = await payrollService.getEntriesNeedingReview();

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          entries,
          count: entries.length
        }
      }
    };
  } catch (error) {
    console.error('Error in handleGetPayrollNeedingReview:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: error.message,
        code: 'FETCH_ERROR'
      }
    };
  }
}

/**
 * PUT /api/payroll/:id
 * Update a payroll entry
 */
async function handleUpdatePayrollEntry(event, entryId) {
  try {
    const body = JSON.parse(event.body || '{}');

    console.log(`✏️ Updating payroll entry: ${entryId}`);

    const updates = {};
    const allowedFields = [
      'regular_hours',
      'overtime_hours',
      'double_time_hours',
      'hourly_rate',
      'overtime_rate',
      'double_time_rate',
      'arrival_time',
      'departure_time',
      'activities',
      'employee_specific_issues',
      'needs_review',
      'review_notes'
    ];

    // Map camelCase to snake_case
    const fieldMapping = {
      regularHours: 'regular_hours',
      overtimeHours: 'overtime_hours',
      doubleTimeHours: 'double_time_hours',
      hourlyRate: 'hourly_rate',
      overtimeRate: 'overtime_rate',
      doubleTimeRate: 'double_time_rate',
      arrivalTime: 'arrival_time',
      departureTime: 'departure_time',
      employeeSpecificIssues: 'employee_specific_issues',
      needsReview: 'needs_review',
      reviewNotes: 'review_notes'
    };

    Object.keys(body).forEach(key => {
      const dbKey = fieldMapping[key] || key;
      if (allowedFields.includes(dbKey)) {
        updates[dbKey] = body[key];
      }
    });

    if (Object.keys(updates).length === 0) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'No valid fields to update',
          code: 'NO_UPDATES'
        }
      };
    }

    await payrollService.updatePayrollEntry(entryId, updates);

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          message: 'Payroll entry updated successfully',
          entryId
        }
      }
    };
  } catch (error) {
    console.error('Error in handleUpdatePayrollEntry:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: error.message,
        code: 'UPDATE_ERROR'
      }
    };
  }
}

/**
 * PUT /api/payroll/:id/review
 * Mark an entry as reviewed
 */
async function handleMarkAsReviewed(event, entryId) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { notes } = body;

    console.log(`✅ Marking payroll entry as reviewed: ${entryId}`);

    await payrollService.markAsReviewed(entryId, notes);

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          message: 'Entry marked as reviewed',
          entryId
        }
      }
    };
  } catch (error) {
    console.error('Error in handleMarkAsReviewed:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: error.message,
        code: 'REVIEW_ERROR'
      }
    };
  }
}

/**
 * DELETE /api/payroll/:id
 * Delete a payroll entry
 */
async function handleDeletePayrollEntry(event, entryId) {
  try {
    console.log(`🗑️ Deleting payroll entry: ${entryId}`);

    await payrollService.deletePayrollEntry(entryId);

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          message: 'Payroll entry deleted successfully',
          entryId
        }
      }
    };
  } catch (error) {
    console.error('Error in handleDeletePayrollEntry:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: error.message,
        code: 'DELETE_ERROR'
      }
    };
  }
}

/**
 * GET /api/payroll/report/daily/:date
 * Generate daily payroll report
 */
async function handleGenerateDailyReport(event, date) {
  try {
    console.log(`📊 Generating daily payroll report for ${date}`);

    const report = await payrollService.generateDailyPayrollReport(date);

    return {
      statusCode: 200,
      body: {
        success: true,
        data: report
      }
    };
  } catch (error) {
    console.error('Error in handleGenerateDailyReport:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: error.message,
        code: 'REPORT_ERROR'
      }
    };
  }
}

/**
 * GET /api/payroll/export/daily/:date
 * Export daily payroll report as CSV
 */
async function handleExportDailyCSV(event, date) {
  try {
    console.log(`📥 Exporting daily payroll CSV for ${date}`);

    const csv = await payrollService.exportDailyPayrollCSV(date);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="payroll-${date}.csv"`
      },
      body: csv
    };
  } catch (error) {
    console.error('Error in handleExportDailyCSV:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: error.message,
        code: 'EXPORT_ERROR'
      }
    };
  }
}

/**
 * GET /api/payroll/employee/:employeeId/timesheet
 * Get employee timesheet for date range
 */
async function handleGetEmployeeTimesheet(event, employeeId) {
  try {
    const queryParams = event.queryStringParameters || {};
    const { startDate, endDate } = queryParams;

    if (!startDate || !endDate) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'Missing required parameters: startDate, endDate',
          code: 'MISSING_DATES'
        }
      };
    }

    console.log(`📋 Generating timesheet for employee ${employeeId} from ${startDate} to ${endDate}`);

    const timesheet = await payrollService.getEmployeeTimesheet(employeeId, startDate, endDate);

    return {
      statusCode: 200,
      body: {
        success: true,
        data: timesheet
      }
    };
  } catch (error) {
    console.error('Error in handleGetEmployeeTimesheet:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: error.message,
        code: 'TIMESHEET_ERROR'
      }
    };
  }
}

/**
 * GET /api/payroll/project/:projectId/costs
 * Get project labor costs
 */
async function handleGetProjectLaborCosts(event, projectId) {
  try {
    const queryParams = event.queryStringParameters || {};
    const { startDate, endDate } = queryParams;

    if (!startDate || !endDate) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'Missing required parameters: startDate, endDate',
          code: 'MISSING_DATES'
        }
      };
    }

    console.log(`💰 Calculating labor costs for project ${projectId} from ${startDate} to ${endDate}`);

    const costs = await payrollService.getProjectLaborCosts(projectId, startDate, endDate);

    return {
      statusCode: 200,
      body: {
        success: true,
        data: costs
      }
    };
  } catch (error) {
    console.error('Error in handleGetProjectLaborCosts:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: error.message,
        code: 'COSTS_ERROR'
      }
    };
  }
}

module.exports = {
  handleCreatePayrollEntry,
  handleCreateBulkPayrollEntries,
  handleGetPayrollEntry,
  handleGetPayrollByReport,
  handleGetPayrollByEmployee,
  handleGetPayrollByProject,
  handleGetPayrollByDate,
  handleGetPayrollNeedingReview,
  handleUpdatePayrollEntry,
  handleMarkAsReviewed,
  handleDeletePayrollEntry,
  handleGenerateDailyReport,
  handleExportDailyCSV,
  handleGetEmployeeTimesheet,
  handleGetProjectLaborCosts
};
