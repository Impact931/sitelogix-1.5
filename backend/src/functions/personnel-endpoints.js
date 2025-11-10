/**
 * Personnel API Endpoints
 * Handles employee management operations using PersonnelService
 */

const personnelService = require('./personnelService');

/**
 * POST /api/personnel/match
 * Match or create employee from name (used by Roxy during report processing)
 */
async function handleMatchOrCreateEmployee(event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { name, projectId } = body;

    if (!name) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'Missing required field: name',
          code: 'MISSING_NAME'
        }
      };
    }

    console.log(`🔍 Matching/creating employee: ${name}`, projectId ? `for project ${projectId}` : '');

    const context = projectId ? { projectId } : undefined;
    const result = await personnelService.matchOrCreateEmployee(name, context);

    return {
      statusCode: 200,
      body: {
        success: true,
        data: result
      }
    };
  } catch (error) {
    console.error('Error in handleMatchOrCreateEmployee:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: error.message,
        code: 'MATCH_ERROR'
      }
    };
  }
}

/**
 * POST /api/personnel
 * Create a new employee
 */
async function handleCreateEmployee(event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const {
      firstName,
      lastName,
      employeeNumber,
      email,
      phone,
      position,
      projectId,
      hourlyRate,
      overtimeRate,
      doubleTimeRate
    } = body;

    if (!firstName || !lastName) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'Missing required fields: firstName, lastName',
          code: 'MISSING_FIELDS'
        }
      };
    }

    console.log(`➕ Creating employee: ${firstName} ${lastName}`);

    const employeeData = {
      first_name: firstName,
      last_name: lastName,
      employee_number: employeeNumber,
      email,
      phone,
      position,
      project_id: projectId,
      hourly_rate: hourlyRate,
      overtime_rate: overtimeRate,
      double_time_rate: doubleTimeRate
    };

    const personId = await personnelService.createEmployee(employeeData);

    return {
      statusCode: 201,
      body: {
        success: true,
        data: {
          personId,
          message: 'Employee created successfully'
        }
      }
    };
  } catch (error) {
    console.error('Error in handleCreateEmployee:', error);
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
 * GET /api/personnel/:id
 * Get employee by ID
 */
async function handleGetEmployee(event, employeeId) {
  try {
    console.log(`🔍 Fetching employee: ${employeeId}`);

    const employee = await personnelService.getEmployeeById(employeeId);

    if (!employee) {
      return {
        statusCode: 404,
        body: {
          success: false,
          error: 'Employee not found',
          code: 'NOT_FOUND'
        }
      };
    }

    return {
      statusCode: 200,
      body: {
        success: true,
        data: employee
      }
    };
  } catch (error) {
    console.error('Error in handleGetEmployee:', error);
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
 * GET /api/personnel
 * List employees with optional filters
 */
async function handleListEmployees(event) {
  try {
    const queryParams = event.queryStringParameters || {};
    const {
      status = 'active',
      projectId,
      limit = '100'
    } = queryParams;

    console.log(`📋 Listing employees with filters:`, { status, projectId, limit });

    const filters = {
      status,
      projectId,
      limit: parseInt(limit, 10)
    };

    const employees = await personnelService.listEmployees(filters);

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          employees,
          count: employees.length
        }
      }
    };
  } catch (error) {
    console.error('Error in handleListEmployees:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: error.message,
        code: 'LIST_ERROR'
      }
    };
  }
}

/**
 * PUT /api/personnel/:id
 * Update employee information
 */
async function handleUpdateEmployee(event, employeeId) {
  try {
    const body = JSON.parse(event.body || '{}');

    console.log(`✏️ Updating employee: ${employeeId}`);

    const updates = {};
    const allowedFields = [
      'first_name',
      'lastName',
      'employee_number',
      'email',
      'phone',
      'position',
      'project_id',
      'hourly_rate',
      'overtime_rate',
      'double_time_rate',
      'employment_status',
      'needs_profile_completion'
    ];

    // Map camelCase to snake_case for DynamoDB
    const fieldMapping = {
      firstName: 'first_name',
      lastName: 'last_name',
      employeeNumber: 'employee_number',
      hourlyRate: 'hourly_rate',
      overtimeRate: 'overtime_rate',
      doubleTimeRate: 'double_time_rate',
      projectId: 'project_id',
      employmentStatus: 'employment_status',
      needsProfileCompletion: 'needs_profile_completion'
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

    await personnelService.updateEmployee(employeeId, updates);

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          message: 'Employee updated successfully',
          personId: employeeId
        }
      }
    };
  } catch (error) {
    console.error('Error in handleUpdateEmployee:', error);
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
 * DELETE /api/personnel/:id
 * Soft delete (terminate) an employee
 */
async function handleDeleteEmployee(event, employeeId) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { terminationDate, reason } = body;

    console.log(`🗑️ Terminating employee: ${employeeId}`);

    await personnelService.terminateEmployee(employeeId, terminationDate, reason);

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          message: 'Employee terminated successfully',
          personId: employeeId
        }
      }
    };
  } catch (error) {
    console.error('Error in handleDeleteEmployee:', error);
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
 * POST /api/personnel/:id/aliases
 * Add an alias/nickname for an employee
 */
async function handleAddEmployeeAlias(event, employeeId) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { alias } = body;

    if (!alias) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'Missing required field: alias',
          code: 'MISSING_ALIAS'
        }
      };
    }

    console.log(`🏷️ Adding alias "${alias}" to employee: ${employeeId}`);

    await personnelService.addEmployeeAlias(employeeId, alias);

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          message: 'Alias added successfully',
          personId: employeeId,
          alias
        }
      }
    };
  } catch (error) {
    console.error('Error in handleAddEmployeeAlias:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: error.message,
        code: 'ADD_ALIAS_ERROR'
      }
    };
  }
}

/**
 * GET /api/personnel/search
 * Search employees by name
 */
async function handleSearchEmployees(event) {
  try {
    const queryParams = event.queryStringParameters || {};
    const { name } = queryParams;

    if (!name) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'Missing required parameter: name',
          code: 'MISSING_NAME'
        }
      };
    }

    console.log(`🔍 Searching employees by name: ${name}`);

    const employees = await personnelService.searchEmployeesByName(name);

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          employees,
          count: employees.length
        }
      }
    };
  } catch (error) {
    console.error('Error in handleSearchEmployees:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: error.message,
        code: 'SEARCH_ERROR'
      }
    };
  }
}

/**
 * GET /api/personnel/number/:employeeNumber
 * Get employee by employee number
 */
async function handleGetEmployeeByNumber(event, employeeNumber) {
  try {
    console.log(`🔍 Fetching employee by number: ${employeeNumber}`);

    const employee = await personnelService.getEmployeeByNumber(employeeNumber);

    if (!employee) {
      return {
        statusCode: 404,
        body: {
          success: false,
          error: 'Employee not found',
          code: 'NOT_FOUND'
        }
      };
    }

    return {
      statusCode: 200,
      body: {
        success: true,
        data: employee
      }
    };
  } catch (error) {
    console.error('Error in handleGetEmployeeByNumber:', error);
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

module.exports = {
  handleMatchOrCreateEmployee,
  handleCreateEmployee,
  handleGetEmployee,
  handleListEmployees,
  handleUpdateEmployee,
  handleDeleteEmployee,
  handleAddEmployeeAlias,
  handleSearchEmployees,
  handleGetEmployeeByNumber
};
