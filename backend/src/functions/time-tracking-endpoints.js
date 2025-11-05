/**
 * Time Tracking Endpoints Handler
 * Provides time entry logging, retrieval, and updates
 *
 * @module time-tracking-endpoints
 */

const { DynamoDBClient, PutItemCommand, UpdateItemCommand, QueryCommand, ScanCommand, GetItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const { v4: uuidv4 } = require('uuid');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });

/**
 * Calculate pay based on hours and rates
 */
function calculatePay(regularHours, overtimeHours, hourlyRate) {
  const overtimeRate = hourlyRate * 1.5;
  const regularPay = regularHours * hourlyRate;
  const overtimePay = overtimeHours * overtimeRate;

  return {
    regularPay: parseFloat(regularPay.toFixed(2)),
    overtimePay: parseFloat(overtimePay.toFixed(2)),
    totalPay: parseFloat((regularPay + overtimePay).toFixed(2))
  };
}

/**
 * POST /api/time-entries
 * Log a time entry for an employee
 */
async function handleCreateTimeEntry(body, user) {
  try {
    const { employeeId, projectId, date, startTime, endTime, breakMinutes, hours, overtimeHours, tasks, notes } = body;

    // Validation
    if (!employeeId || !projectId || !date || !hours) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'Validation failed',
          details: [
            { field: 'employeeId', message: 'Employee ID is required' },
            { field: 'projectId', message: 'Project ID is required' },
            { field: 'date', message: 'Date is required' },
            { field: 'hours', message: 'Hours are required' }
          ].filter(d => !body[d.field])
        }
      };
    }

    // Check permissions - employee can only create their own entries
    if (user.role !== 'admin' && user.role !== 'manager' && employeeId !== user.userId) {
      return {
        statusCode: 403,
        body: {
          success: false,
          error: 'Insufficient permissions',
          code: 'PERMISSION_DENIED'
        }
      };
    }

    // Get employee details for pay calculation
    const getEmployeeCommand = new GetItemCommand({
      TableName: 'sitelogix-personnel',
      Key: {
        PK: { S: `PERSONNEL#${employeeId}` },
        SK: { S: 'METADATA' }
      }
    });

    const employeeResult = await dynamoClient.send(getEmployeeCommand);

    if (!employeeResult.Item) {
      return {
        statusCode: 404,
        body: {
          success: false,
          error: 'Employee not found',
          employeeId
        }
      };
    }

    const employee = unmarshall(employeeResult.Item);

    // Get project details
    const getProjectCommand = new GetItemCommand({
      TableName: 'sitelogix-projects',
      Key: {
        PK: { S: `PROJECT#${projectId}` },
        SK: { S: 'METADATA' }
      }
    });

    const projectResult = await dynamoClient.send(getProjectCommand);

    if (!projectResult.Item) {
      return {
        statusCode: 404,
        body: {
          success: false,
          error: 'Project not found',
          projectId
        }
      };
    }

    const project = unmarshall(projectResult.Item);

    // Calculate pay
    const regularHours = parseFloat(hours) - (parseFloat(overtimeHours) || 0);
    const pay = calculatePay(regularHours, parseFloat(overtimeHours) || 0, employee.hourly_rate);

    const timeEntryId = uuidv4();
    const timestamp = new Date().toISOString();

    const timeEntry = {
      PK: `TIME_ENTRY#${timeEntryId}`,
      SK: 'METADATA',
      time_entry_id: timeEntryId,
      employee_id: employeeId,
      employee_name: employee.full_name,
      project_id: projectId,
      project_name: project.project_name,
      date,
      start_time: startTime || '',
      end_time: endTime || '',
      break_minutes: parseInt(breakMinutes) || 0,
      hours: parseFloat(hours),
      regular_hours: regularHours,
      overtime_hours: parseFloat(overtimeHours) || 0,
      hourly_rate: employee.hourly_rate,
      regular_pay: pay.regularPay,
      overtime_pay: pay.overtimePay,
      total_pay: pay.totalPay,
      tasks: tasks || [],
      notes: notes || '',
      status: 'submitted',
      created_at: timestamp,
      created_by: user.userId,
      updated_at: timestamp
    };

    const command = new PutItemCommand({
      TableName: 'sitelogix-time-entries',
      Item: marshall(timeEntry)
    });

    await dynamoClient.send(command);

    return {
      statusCode: 201,
      body: {
        success: true,
        timeEntry: {
          timeEntryId,
          employeeId,
          employeeName: employee.full_name,
          projectId,
          projectName: project.project_name,
          date,
          hours: timeEntry.hours,
          overtimeHours: timeEntry.overtime_hours,
          createdAt: timestamp
        }
      }
    };
  } catch (error) {
    console.error('Create time entry error:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      }
    };
  }
}

/**
 * GET /api/time-entries
 * Get time entries with filtering
 */
async function handleListTimeEntries(queryParams, user) {
  try {
    const { employeeId, projectId, startDate, endDate, limit = 50, offset = 0 } = queryParams;

    let command;
    let items = [];

    // Build query based on filters
    if (employeeId) {
      // Query by employee (using GSI)
      command = new QueryCommand({
        TableName: 'sitelogix-time-entries',
        IndexName: 'GSI1-EmployeeIndex',
        KeyConditionExpression: 'employee_id = :employeeId',
        ExpressionAttributeValues: marshall({
          ':employeeId': employeeId
        })
      });
    } else if (projectId) {
      // Query by project (using GSI)
      command = new QueryCommand({
        TableName: 'sitelogix-time-entries',
        IndexName: 'GSI2-ProjectIndex',
        KeyConditionExpression: 'project_id = :projectId',
        ExpressionAttributeValues: marshall({
          ':projectId': projectId
        })
      });
    } else {
      // Scan all time entries
      command = new ScanCommand({
        TableName: 'sitelogix-time-entries',
        Limit: parseInt(limit)
      });
    }

    const result = await dynamoClient.send(command);
    items = result.Items.map(item => unmarshall(item));

    // Apply date filters
    if (startDate) {
      items = items.filter(entry => entry.date >= startDate);
    }

    if (endDate) {
      items = items.filter(entry => entry.date <= endDate);
    }

    // Filter by user permissions
    if (user.role !== 'admin' && user.role !== 'manager') {
      // Regular employees only see their own entries
      items = items.filter(entry => entry.employee_id === user.userId);
    }

    // Sort by date descending
    items.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Apply pagination
    const paginatedItems = items.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    // Transform to API format
    const timeEntries = paginatedItems.map(entry => ({
      timeEntryId: entry.time_entry_id,
      employeeId: entry.employee_id,
      employeeName: entry.employee_name,
      projectId: entry.project_id,
      projectName: entry.project_name,
      date: entry.date,
      startTime: entry.start_time,
      endTime: entry.end_time,
      hours: entry.hours,
      overtimeHours: entry.overtime_hours,
      regularPay: entry.regular_pay,
      overtimePay: entry.overtime_pay,
      totalPay: entry.total_pay,
      tasks: entry.tasks || [],
      createdAt: entry.created_at
    }));

    // Calculate summary
    const summary = {
      totalEntries: timeEntries.length,
      totalHours: timeEntries.reduce((sum, e) => sum + e.hours, 0),
      totalRegularHours: timeEntries.reduce((sum, e) => sum + (e.hours - e.overtimeHours), 0),
      totalOvertimeHours: timeEntries.reduce((sum, e) => sum + e.overtimeHours, 0),
      totalPay: timeEntries.reduce((sum, e) => sum + e.totalPay, 0)
    };

    return {
      statusCode: 200,
      body: {
        success: true,
        timeEntries,
        summary,
        pagination: {
          total: items.length,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: items.length > (parseInt(offset) + parseInt(limit))
        }
      }
    };
  } catch (error) {
    console.error('List time entries error:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      }
    };
  }
}

/**
 * PUT /api/time-entries/:id
 * Update an existing time entry
 */
async function handleUpdateTimeEntry(timeEntryId, body, user) {
  try {
    // Only managers and admins can update time entries
    if (user.role !== 'admin' && user.role !== 'manager') {
      return {
        statusCode: 403,
        body: {
          success: false,
          error: 'Insufficient permissions',
          code: 'PERMISSION_DENIED'
        }
      };
    }

    // Get existing entry
    const getCommand = new GetItemCommand({
      TableName: 'sitelogix-time-entries',
      Key: {
        PK: { S: `TIME_ENTRY#${timeEntryId}` },
        SK: { S: 'METADATA' }
      }
    });

    const result = await dynamoClient.send(getCommand);

    if (!result.Item) {
      return {
        statusCode: 404,
        body: {
          success: false,
          error: 'Time entry not found',
          timeEntryId
        }
      };
    }

    const timeEntry = unmarshall(result.Item);

    // Check if entry is within 7 days
    const entryDate = new Date(timeEntry.date);
    const today = new Date();
    const daysDiff = Math.floor((today - entryDate) / (1000 * 60 * 60 * 24));

    if (daysDiff > 7 && user.role !== 'admin') {
      return {
        statusCode: 403,
        body: {
          success: false,
          error: 'Time entries older than 7 days can only be updated by admins',
          code: 'PERMISSION_DENIED'
        }
      };
    }

    // Build update expression
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    const allowedFields = ['hours', 'overtimeHours', 'startTime', 'endTime', 'breakMinutes', 'tasks', 'notes', 'status'];

    // Recalculate pay if hours changed
    let needsPayRecalc = false;
    if (body.hours !== undefined || body.overtimeHours !== undefined) {
      needsPayRecalc = true;
    }

    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        const dbField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
        updateExpressions.push(`#${dbField} = :${dbField}`);
        expressionAttributeNames[`#${dbField}`] = dbField;

        if (field === 'hours' || field === 'overtimeHours') {
          expressionAttributeValues[`:${dbField}`] = { N: String(body[field]) };
        } else if (field === 'breakMinutes') {
          expressionAttributeValues[`:${dbField}`] = { N: String(body[field]) };
        } else if (field === 'tasks') {
          expressionAttributeValues[`:${dbField}`] = marshall(body[field]);
        } else {
          expressionAttributeValues[`:${dbField}`] = { S: String(body[field]) };
        }
      }
    });

    // Recalculate pay if needed
    if (needsPayRecalc) {
      const newHours = body.hours !== undefined ? parseFloat(body.hours) : timeEntry.hours;
      const newOvertimeHours = body.overtimeHours !== undefined ? parseFloat(body.overtimeHours) : timeEntry.overtime_hours;
      const regularHours = newHours - newOvertimeHours;

      const pay = calculatePay(regularHours, newOvertimeHours, timeEntry.hourly_rate);

      updateExpressions.push('regular_hours = :regular_hours');
      updateExpressions.push('regular_pay = :regular_pay');
      updateExpressions.push('overtime_pay = :overtime_pay');
      updateExpressions.push('total_pay = :total_pay');

      expressionAttributeValues[':regular_hours'] = { N: String(regularHours) };
      expressionAttributeValues[':regular_pay'] = { N: String(pay.regularPay) };
      expressionAttributeValues[':overtime_pay'] = { N: String(pay.overtimePay) };
      expressionAttributeValues[':total_pay'] = { N: String(pay.totalPay) };
    }

    // Always update timestamp and updated_by
    updateExpressions.push('updated_at = :updated_at');
    updateExpressions.push('updated_by = :updated_by');
    expressionAttributeValues[':updated_at'] = { S: new Date().toISOString() };
    expressionAttributeValues[':updated_by'] = { S: user.userId };

    const updateCommand = new UpdateItemCommand({
      TableName: 'sitelogix-time-entries',
      Key: {
        PK: { S: `TIME_ENTRY#${timeEntryId}` },
        SK: { S: 'METADATA' }
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    });

    const updateResult = await dynamoClient.send(updateCommand);
    const updated = unmarshall(updateResult.Attributes);

    return {
      statusCode: 200,
      body: {
        success: true,
        timeEntry: {
          timeEntryId,
          employeeId: updated.employee_id,
          hours: updated.hours,
          overtimeHours: updated.overtime_hours,
          updatedAt: updated.updated_at
        }
      }
    };
  } catch (error) {
    console.error('Update time entry error:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      }
    };
  }
}

/**
 * GET /api/employees/:id/hours
 * Get employee hours breakdown by period
 */
async function handleGetEmployeeHours(employeeId, queryParams, user) {
  try {
    // Check permissions
    if (user.role !== 'admin' && user.role !== 'manager' && user.userId !== employeeId) {
      return {
        statusCode: 403,
        body: {
          success: false,
          error: 'Insufficient permissions',
          code: 'PERMISSION_DENIED'
        }
      };
    }

    const { period, startDate, endDate, projectId } = queryParams;

    if (!period) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'Period is required',
          code: 'VALIDATION_ERROR'
        }
      };
    }

    // Calculate date range based on period
    let start, end;
    const today = new Date();

    switch (period) {
      case 'week':
        start = new Date(today);
        start.setDate(today.getDate() - 7);
        end = today;
        break;
      case 'month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'quarter':
        const quarter = Math.floor(today.getMonth() / 3);
        start = new Date(today.getFullYear(), quarter * 3, 1);
        end = new Date(today.getFullYear(), quarter * 3 + 3, 0);
        break;
      case 'year':
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today.getFullYear(), 11, 31);
        break;
      case 'custom':
        if (!startDate || !endDate) {
          return {
            statusCode: 400,
            body: {
              success: false,
              error: 'Start date and end date required for custom period',
              code: 'VALIDATION_ERROR'
            }
          };
        }
        start = new Date(startDate);
        end = new Date(endDate);
        break;
      default:
        return {
          statusCode: 400,
          body: {
            success: false,
            error: 'Invalid period',
            code: 'VALIDATION_ERROR'
          }
        };
    }

    const startDateStr = start.toISOString().split('T')[0];
    const endDateStr = end.toISOString().split('T')[0];

    // Get employee details
    const getEmployeeCommand = new GetItemCommand({
      TableName: 'sitelogix-personnel',
      Key: {
        PK: { S: `PERSONNEL#${employeeId}` },
        SK: { S: 'METADATA' }
      }
    });

    const employeeResult = await dynamoClient.send(getEmployeeCommand);

    if (!employeeResult.Item) {
      return {
        statusCode: 404,
        body: {
          success: false,
          error: 'Employee not found',
          employeeId
        }
      };
    }

    const employee = unmarshall(employeeResult.Item);

    // Query time entries for employee in date range
    const queryCommand = new QueryCommand({
      TableName: 'sitelogix-time-entries',
      IndexName: 'GSI1-EmployeeIndex',
      KeyConditionExpression: 'employee_id = :employeeId',
      FilterExpression: '#date BETWEEN :startDate AND :endDate',
      ExpressionAttributeNames: {
        '#date': 'date'
      },
      ExpressionAttributeValues: marshall({
        ':employeeId': employeeId,
        ':startDate': startDateStr,
        ':endDate': endDateStr
      })
    });

    const result = await dynamoClient.send(queryCommand);
    let entries = result.Items.map(item => unmarshall(item));

    // Filter by project if specified
    if (projectId) {
      entries = entries.filter(e => e.project_id === projectId);
    }

    // Calculate summary
    const totalRegularHours = entries.reduce((sum, e) => sum + (e.regular_hours || 0), 0);
    const totalOvertimeHours = entries.reduce((sum, e) => sum + (e.overtime_hours || 0), 0);
    const totalHours = totalRegularHours + totalOvertimeHours;
    const regularPay = entries.reduce((sum, e) => sum + (e.regular_pay || 0), 0);
    const overtimePay = entries.reduce((sum, e) => sum + (e.overtime_pay || 0), 0);
    const totalPay = regularPay + overtimePay;

    const daysWorked = new Set(entries.map(e => e.date)).size;
    const averageHoursPerDay = daysWorked > 0 ? totalHours / daysWorked : 0;

    // Breakdown by day
    const breakdown = entries.map(entry => ({
      date: entry.date,
      projectId: entry.project_id,
      projectName: entry.project_name,
      regularHours: entry.regular_hours || 0,
      overtimeHours: entry.overtime_hours || 0,
      totalHours: entry.hours,
      tasks: entry.tasks || []
    }));

    // Breakdown by project
    const projectMap = new Map();
    entries.forEach(entry => {
      const proj = projectMap.get(entry.project_id) || {
        projectId: entry.project_id,
        projectName: entry.project_name,
        totalHours: 0
      };
      proj.totalHours += entry.hours;
      projectMap.set(entry.project_id, proj);
    });

    const byProject = Array.from(projectMap.values()).map(proj => ({
      ...proj,
      percentage: parseFloat(((proj.totalHours / totalHours) * 100).toFixed(1))
    }));

    return {
      statusCode: 200,
      body: {
        success: true,
        employeeId,
        fullName: employee.full_name,
        period,
        startDate: startDateStr,
        endDate: endDateStr,
        summary: {
          totalRegularHours: parseFloat(totalRegularHours.toFixed(2)),
          totalOvertimeHours: parseFloat(totalOvertimeHours.toFixed(2)),
          totalHours: parseFloat(totalHours.toFixed(2)),
          regularPay: parseFloat(regularPay.toFixed(2)),
          overtimePay: parseFloat(overtimePay.toFixed(2)),
          totalPay: parseFloat(totalPay.toFixed(2)),
          averageHoursPerDay: parseFloat(averageHoursPerDay.toFixed(2)),
          daysWorked
        },
        breakdown,
        byProject
      }
    };
  } catch (error) {
    console.error('Get employee hours error:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      }
    };
  }
}

module.exports = {
  handleCreateTimeEntry,
  handleListTimeEntries,
  handleUpdateTimeEntry,
  handleGetEmployeeHours
};
