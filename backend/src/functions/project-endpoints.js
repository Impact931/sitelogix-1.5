/**
 * Project Management Endpoints Handler
 * Provides project CRUD operations, status updates, and timeline management
 *
 * @module project-endpoints
 */

const { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand, DeleteItemCommand, QueryCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const { v4: uuidv4 } = require('uuid');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });

/**
 * GET /api/projects
 * List all projects with filtering
 */
async function handleListProjects(queryParams, user) {
  try {
    const { status, managerId, search, limit = 50, offset = 0 } = queryParams;

    let command;
    let items = [];

    // Build query based on filters
    if (managerId) {
      // Query by manager (using GSI)
      command = new QueryCommand({
        TableName: 'sitelogix-projects',
        IndexName: 'GSI1-ManagerIndex',
        KeyConditionExpression: 'manager_id = :managerId',
        ExpressionAttributeValues: marshall({
          ':managerId': managerId
        })
      });
    } else if (status) {
      // Query by status (using GSI)
      command = new QueryCommand({
        TableName: 'sitelogix-projects',
        IndexName: 'GSI2-StatusIndex',
        KeyConditionExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: marshall({
          ':status': status
        })
      });
    } else {
      // Scan all projects
      command = new ScanCommand({
        TableName: 'sitelogix-projects',
        Limit: parseInt(limit)
      });
    }

    const result = await dynamoClient.send(command);
    items = result.Items.map(item => unmarshall(item));

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      items = items.filter(proj =>
        proj.project_name?.toLowerCase().includes(searchLower) ||
        proj.location?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by user permissions
    if (user.role !== 'admin' && user.role !== 'manager') {
      // Regular employees only see assigned projects
      items = items.filter(proj =>
        proj.assigned_personnel?.includes(user.userId)
      );
    }

    // Apply pagination
    const paginatedItems = items.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    // Transform to API format
    const projects = paginatedItems.map(proj => ({
      projectId: proj.project_id,
      projectName: proj.project_name,
      projectCode: proj.project_code,
      location: proj.location,
      status: proj.status,
      startDate: proj.start_date,
      estimatedEndDate: proj.estimated_end_date,
      actualEndDate: proj.actual_end_date,
      budget: proj.budget_total,
      currentSpend: proj.current_spend,
      percentComplete: proj.percent_complete,
      assignedManagers: proj.assigned_managers || [],
      personnelCount: proj.personnel_count || 0,
      activeConstraints: proj.active_constraints || 0,
      healthScore: proj.health_score || 0,
      lastReportDate: proj.last_report_date
    }));

    return {
      statusCode: 200,
      body: {
        success: true,
        projects,
        pagination: {
          total: items.length,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: items.length > (parseInt(offset) + parseInt(limit))
        }
      }
    };
  } catch (error) {
    console.error('List projects error:', error);
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
 * GET /api/projects/:id
 * Get detailed project information
 */
async function handleGetProject(projectId, user) {
  try {
    const command = new GetItemCommand({
      TableName: 'sitelogix-projects',
      Key: {
        PK: { S: `PROJECT#${projectId}` },
        SK: { S: 'METADATA' }
      }
    });

    const result = await dynamoClient.send(command);

    if (!result.Item) {
      return {
        statusCode: 404,
        body: {
          success: false,
          error: 'Project not found',
          projectId
        }
      };
    }

    const proj = unmarshall(result.Item);

    // Check permissions
    const isAssigned = proj.assigned_managers?.some(m => m.managerId === user.userId) ||
                       proj.assigned_personnel?.includes(user.userId);

    if (user.role !== 'admin' && !isAssigned) {
      return {
        statusCode: 403,
        body: {
          success: false,
          error: 'Insufficient permissions',
          code: 'PERMISSION_DENIED'
        }
      };
    }

    return {
      statusCode: 200,
      body: {
        success: true,
        project: {
          projectId: proj.project_id,
          projectName: proj.project_name,
          projectCode: proj.project_code,
          description: proj.description,
          location: proj.location,
          status: proj.status,
          startDate: proj.start_date,
          estimatedEndDate: proj.estimated_end_date,
          actualEndDate: proj.actual_end_date,
          budget: {
            total: proj.budget_total,
            labor: proj.budget_labor,
            materials: proj.budget_materials,
            equipment: proj.budget_equipment
          },
          currentSpend: {
            total: proj.current_spend,
            labor: proj.current_spend_labor,
            materials: proj.current_spend_materials,
            equipment: proj.current_spend_equipment
          },
          percentComplete: proj.percent_complete,
          assignedManagers: proj.assigned_managers || [],
          assignedPersonnel: proj.assigned_personnel || [],
          milestones: proj.milestones || [],
          activeConstraints: proj.active_constraints || 0,
          safetyIncidents: proj.safety_incidents || 0,
          healthScore: proj.health_score || 0,
          metrics: proj.metrics || {},
          createdAt: proj.created_at,
          updatedAt: proj.updated_at
        }
      }
    };
  } catch (error) {
    console.error('Get project error:', error);
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
 * POST /api/projects
 * Create new project
 */
async function handleCreateProject(body, user) {
  try {
    // Check permissions
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

    const { projectName, projectCode, description, location, startDate, estimatedEndDate, budget } = body;

    // Validation
    if (!projectName || !projectCode || !startDate) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'Validation failed',
          details: [
            { field: 'projectName', message: 'Project name is required' },
            { field: 'projectCode', message: 'Project code is required' },
            { field: 'startDate', message: 'Start date is required' }
          ].filter(d => !body[d.field])
        }
      };
    }

    const projectId = `proj_${Date.now()}`;
    const timestamp = new Date().toISOString();

    const project = {
      PK: `PROJECT#${projectId}`,
      SK: 'METADATA',
      project_id: projectId,
      project_name: projectName,
      project_code: projectCode,
      description: description || '',
      location: location || {},
      status: 'planning',
      start_date: startDate,
      estimated_end_date: estimatedEndDate,
      actual_end_date: null,
      budget_total: budget?.total || 0,
      budget_labor: budget?.labor || 0,
      budget_materials: budget?.materials || 0,
      budget_equipment: budget?.equipment || 0,
      current_spend: 0,
      current_spend_labor: 0,
      current_spend_materials: 0,
      current_spend_equipment: 0,
      percent_complete: 0,
      assigned_managers: body.assignedManagers || [{ managerId: user.userId, name: user.fullName, role: 'project_manager', assignedDate: timestamp }],
      assigned_personnel: [],
      milestones: body.milestones || [],
      active_constraints: 0,
      safety_incidents: 0,
      health_score: 100,
      metrics: {},
      created_at: timestamp,
      updated_at: timestamp
    };

    const command = new PutItemCommand({
      TableName: 'sitelogix-projects',
      Item: marshall(project)
    });

    await dynamoClient.send(command);

    return {
      statusCode: 201,
      body: {
        success: true,
        project: {
          projectId,
          projectName,
          projectCode,
          status: 'planning',
          createdAt: timestamp
        }
      }
    };
  } catch (error) {
    console.error('Create project error:', error);
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
 * PUT /api/projects/:id
 * Update project information
 */
async function handleUpdateProject(projectId, body, user) {
  try {
    // Check if user is assigned to project or is admin
    const getCommand = new GetItemCommand({
      TableName: 'sitelogix-projects',
      Key: {
        PK: { S: `PROJECT#${projectId}` },
        SK: { S: 'METADATA' }
      }
    });

    const result = await dynamoClient.send(getCommand);

    if (!result.Item) {
      return {
        statusCode: 404,
        body: {
          success: false,
          error: 'Project not found',
          projectId
        }
      };
    }

    const project = unmarshall(result.Item);
    const isAssigned = project.assigned_managers?.some(m => m.managerId === user.userId);

    if (user.role !== 'admin' && !isAssigned) {
      return {
        statusCode: 403,
        body: {
          success: false,
          error: 'Insufficient permissions',
          code: 'PERMISSION_DENIED'
        }
      };
    }

    // Build update expression
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    const allowedFields = ['status', 'estimatedEndDate', 'budget', 'percentComplete', 'description', 'location'];

    Object.keys(body).forEach(key => {
      if (allowedFields.includes(key)) {
        const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();

        if (key === 'budget') {
          // Handle budget object
          if (body.budget.total !== undefined) {
            updateExpressions.push('budget_total = :budget_total');
            expressionAttributeValues[':budget_total'] = { N: String(body.budget.total) };
          }
          if (body.budget.labor !== undefined) {
            updateExpressions.push('budget_labor = :budget_labor');
            expressionAttributeValues[':budget_labor'] = { N: String(body.budget.labor) };
          }
          if (body.budget.materials !== undefined) {
            updateExpressions.push('budget_materials = :budget_materials');
            expressionAttributeValues[':budget_materials'] = { N: String(body.budget.materials) };
          }
          if (body.budget.equipment !== undefined) {
            updateExpressions.push('budget_equipment = :budget_equipment');
            expressionAttributeValues[':budget_equipment'] = { N: String(body.budget.equipment) };
          }
        } else {
          updateExpressions.push(`#${dbField} = :${dbField}`);
          expressionAttributeNames[`#${dbField}`] = dbField;
          expressionAttributeValues[`:${dbField}`] = marshall({ value: body[key] }).value;
        }
      }
    });

    // Always update timestamp
    updateExpressions.push('updated_at = :updated_at');
    expressionAttributeValues[':updated_at'] = { S: new Date().toISOString() };

    const updateCommand = new UpdateItemCommand({
      TableName: 'sitelogix-projects',
      Key: {
        PK: { S: `PROJECT#${projectId}` },
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
        project: {
          projectId,
          projectName: updated.project_name,
          status: updated.status,
          percentComplete: updated.percent_complete,
          updatedAt: updated.updated_at
        }
      }
    };
  } catch (error) {
    console.error('Update project error:', error);
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
 * DELETE /api/projects/:id
 * Archive project (soft delete)
 */
async function handleDeleteProject(projectId, queryParams, user) {
  try {
    // Only admin can delete projects
    if (user.role !== 'admin') {
      return {
        statusCode: 403,
        body: {
          success: false,
          error: 'Insufficient permissions',
          code: 'PERMISSION_DENIED'
        }
      };
    }

    const hardDelete = queryParams.hardDelete === 'true';
    const timestamp = new Date().toISOString();

    if (hardDelete) {
      // Permanent deletion
      const command = new DeleteItemCommand({
        TableName: 'sitelogix-projects',
        Key: {
          PK: { S: `PROJECT#${projectId}` },
          SK: { S: 'METADATA' }
        }
      });

      await dynamoClient.send(command);

      return {
        statusCode: 200,
        body: {
          success: true,
          message: 'Project permanently deleted',
          projectId
        }
      };
    } else {
      // Soft delete - set status to archived
      const command = new UpdateItemCommand({
        TableName: 'sitelogix-projects',
        Key: {
          PK: { S: `PROJECT#${projectId}` },
          SK: { S: 'METADATA' }
        },
        UpdateExpression: 'SET #status = :status, archived_at = :archived_at, archive_reason = :reason',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: marshall({
          ':status': 'archived',
          ':archived_at': timestamp,
          ':reason': queryParams.reason || 'Not specified'
        })
      });

      await dynamoClient.send(command);

      return {
        statusCode: 200,
        body: {
          success: true,
          message: 'Project archived successfully',
          projectId,
          archivedAt: timestamp
        }
      };
    }
  } catch (error) {
    console.error('Delete project error:', error);
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
 * PUT /api/projects/:id/status
 * Update project status
 */
async function handleUpdateProjectStatus(projectId, body, user) {
  try {
    const { status, reason, notes } = body;

    if (!status) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'Status is required',
          code: 'VALIDATION_ERROR'
        }
      };
    }

    // Validate status
    const validStatuses = ['planning', 'active', 'on_hold', 'completed', 'archived'];
    if (!validStatuses.includes(status)) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
          code: 'VALIDATION_ERROR'
        }
      };
    }

    const command = new UpdateItemCommand({
      TableName: 'sitelogix-projects',
      Key: {
        PK: { S: `PROJECT#${projectId}` },
        SK: { S: 'METADATA' }
      },
      UpdateExpression: 'SET #status = :status, status_reason = :reason, status_notes = :notes, updated_at = :updated_at',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: marshall({
        ':status': status,
        ':reason': reason || '',
        ':notes': notes || '',
        ':updated_at': new Date().toISOString()
      }),
      ReturnValues: 'ALL_NEW'
    });

    const result = await dynamoClient.send(command);
    const updated = unmarshall(result.Attributes);

    return {
      statusCode: 200,
      body: {
        success: true,
        project: {
          projectId,
          projectName: updated.project_name,
          status: updated.status,
          statusReason: updated.status_reason,
          updatedAt: updated.updated_at
        }
      }
    };
  } catch (error) {
    console.error('Update project status error:', error);
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
 * POST /api/projects/:id/timeline
 * Update project timeline and milestones
 */
async function handleUpdateProjectTimeline(projectId, body, user) {
  try {
    const { milestones, estimatedEndDate, notes } = body;

    if (!milestones && !estimatedEndDate) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'Milestones or estimated end date required',
          code: 'VALIDATION_ERROR'
        }
      };
    }

    // Get current project
    const getCommand = new GetItemCommand({
      TableName: 'sitelogix-projects',
      Key: {
        PK: { S: `PROJECT#${projectId}` },
        SK: { S: 'METADATA' }
      }
    });

    const result = await dynamoClient.send(getCommand);

    if (!result.Item) {
      return {
        statusCode: 404,
        body: {
          success: false,
          error: 'Project not found',
          projectId
        }
      };
    }

    const project = unmarshall(result.Item);
    const currentMilestones = project.milestones || [];
    const timestamp = new Date().toISOString();

    // Process milestone updates
    const updatedMilestones = [...currentMilestones];

    if (milestones && Array.isArray(milestones)) {
      milestones.forEach(milestone => {
        if (milestone.milestoneId) {
          // Update existing milestone
          const index = updatedMilestones.findIndex(m => m.milestoneId === milestone.milestoneId);
          if (index >= 0) {
            updatedMilestones[index] = {
              ...updatedMilestones[index],
              ...milestone,
              updatedAt: timestamp
            };
          }
        } else {
          // Add new milestone
          updatedMilestones.push({
            milestoneId: `ms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...milestone,
            createdAt: timestamp,
            updatedAt: timestamp
          });
        }
      });
    }

    // Update project
    const updateCommand = new UpdateItemCommand({
      TableName: 'sitelogix-projects',
      Key: {
        PK: { S: `PROJECT#${projectId}` },
        SK: { S: 'METADATA' }
      },
      UpdateExpression: 'SET milestones = :milestones, estimated_end_date = :estimated_end_date, timeline_notes = :notes, updated_at = :updated_at',
      ExpressionAttributeValues: marshall({
        ':milestones': updatedMilestones,
        ':estimated_end_date': estimatedEndDate || project.estimated_end_date,
        ':notes': notes || '',
        ':updated_at': timestamp
      }),
      ReturnValues: 'ALL_NEW'
    });

    const updateResult = await dynamoClient.send(updateCommand);
    const updated = unmarshall(updateResult.Attributes);

    return {
      statusCode: 200,
      body: {
        success: true,
        project: {
          projectId,
          milestones: updated.milestones,
          estimatedEndDate: updated.estimated_end_date,
          updatedAt: updated.updated_at
        }
      }
    };
  } catch (error) {
    console.error('Update project timeline error:', error);
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
  handleListProjects,
  handleGetProject,
  handleCreateProject,
  handleUpdateProject,
  handleDeleteProject,
  handleUpdateProjectStatus,
  handleUpdateProjectTimeline
};
