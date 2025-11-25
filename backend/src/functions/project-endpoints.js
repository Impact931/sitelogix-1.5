/**
 * Project Management Endpoints
 * Handles CRUD operations for projects in DynamoDB
 */

const { DynamoDBClient, ScanCommand, GetItemCommand, PutItemCommand, UpdateItemCommand, DeleteItemCommand, QueryCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall, marshall } = require('@aws-sdk/util-dynamodb');
const { v4: uuidv4 } = require('uuid');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const PROJECTS_TABLE = 'sitelogix-projects';
const PERSONNEL_TABLE = 'sitelogix-personnel';

/**
 * List all projects
 * GET /api/projects/admin
 */
async function handleListProjects(event) {
  try {
    const params = {
      TableName: PROJECTS_TABLE
    };

    const command = new ScanCommand(params);
    const result = await dynamoClient.send(command);

    const projects = result.Items ? result.Items.map(item => {
      const project = unmarshall(item);

      // Normalize project schema: ensure all required nested objects exist with defaults
      return {
        projectId: project.projectId,
        projectName: project.projectName || '',
        projectCode: project.projectCode || '',
        description: project.description || '',
        location: project.location || {
          address: '',
          city: '',
          state: '',
          zip: ''
        },
        projectType: project.projectType || 'construction',
        status: project.status || 'active',
        startDate: project.startDate || '',
        estimatedEndDate: project.estimatedEndDate || '',
        targetCompletionPercentage: project.targetCompletionPercentage || 0,
        budget: project.budget || {
          total: 0,
          labor: 0,
          materials: 0,
          equipment: 0
        },
        kpiTargets: project.kpiTargets || {
          healthScore: 85,
          qualityScore: 90,
          scheduleScore: 85,
          maxOvertimePercent: 15,
          vendorOnTimeRate: 90
        },
        assignedManagers: project.assignedManagers || [],
        milestones: project.milestones || [],
        createdAt: project.createdAt || new Date().toISOString(),
        updatedAt: project.updatedAt || new Date().toISOString(),
        id: project.projectId || project.id  // Add id field for frontend compatibility
      };
    }) : [];

    console.log(`✅ Found ${projects.length} projects`);
    if (projects.length > 0) {
      console.log('First project:', JSON.stringify(projects[0], null, 2));
    }

    return {
      statusCode: 200,
      body: {
        success: true,
        projects: projects
      }
    };
  } catch (error) {
    console.error('Error listing projects:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: error.message || 'Failed to list projects'
      }
    };
  }
}

/**
 * Get a single project by ID
 * GET /api/projects/admin/:id
 */
async function handleGetProject(event, projectId) {
  try {
    const params = {
      TableName: PROJECTS_TABLE,
      Key: marshall({ projectId })
    };

    const command = new GetItemCommand(params);
    const result = await dynamoClient.send(command);

    if (!result.Item) {
      return {
        statusCode: 404,
        body: {
          success: false,
          error: 'Project not found'
        }
      };
    }

    const rawProject = unmarshall(result.Item);

    // Normalize project schema: ensure all required nested objects exist with defaults
    const project = {
      projectId: rawProject.projectId,
      projectName: rawProject.projectName || '',
      projectCode: rawProject.projectCode || '',
      description: rawProject.description || '',
      location: rawProject.location || {
        address: '',
        city: '',
        state: '',
        zip: ''
      },
      projectType: rawProject.projectType || 'construction',
      status: rawProject.status || 'active',
      startDate: rawProject.startDate || '',
      estimatedEndDate: rawProject.estimatedEndDate || '',
      targetCompletionPercentage: rawProject.targetCompletionPercentage || 0,
      budget: rawProject.budget || {
        total: 0,
        labor: 0,
        materials: 0,
        equipment: 0
      },
      kpiTargets: rawProject.kpiTargets || {
        healthScore: 85,
        qualityScore: 90,
        scheduleScore: 85,
        maxOvertimePercent: 15,
        vendorOnTimeRate: 90
      },
      assignedManagers: rawProject.assignedManagers || [],
      milestones: rawProject.milestones || [],
      createdAt: rawProject.createdAt || new Date().toISOString(),
      updatedAt: rawProject.updatedAt || new Date().toISOString(),
      id: rawProject.projectId || rawProject.id
    };

    return {
      statusCode: 200,
      body: {
        success: true,
        project
      }
    };
  } catch (error) {
    console.error('Error getting project:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: error.message || 'Failed to get project'
      }
    };
  }
}

/**
 * Create a new project
 * POST /api/projects/admin
 */
async function handleCreateProject(event) {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

    // Generate project ID
    const projectId = `proj_${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();

    // Build project object with all fields
    const project = {
      projectId,
      projectName: body.projectName,
      projectCode: body.projectCode || '',
      description: body.description || '',
      location: body.location || {
        address: '',
        city: '',
        state: '',
        zip: ''
      },
      projectType: body.projectType || 'construction',
      status: body.status || 'planning',
      startDate: body.startDate || now,
      estimatedEndDate: body.estimatedEndDate || '',
      targetCompletionPercentage: body.targetCompletionPercentage || 0,
      budget: body.budget || {
        total: 0,
        labor: 0,
        materials: 0,
        equipment: 0
      },
      kpiTargets: body.kpiTargets || {
        healthScore: 80,
        qualityScore: 85,
        scheduleScore: 90,
        maxOvertimePercent: 15,
        vendorOnTimeRate: 95
      },
      assignedManagers: body.assignedManagers || [],
      milestones: body.milestones || [],
      createdAt: now,
      updatedAt: now
    };

    // Save to DynamoDB
    const params = {
      TableName: PROJECTS_TABLE,
      Item: marshall(project)
    };

    const command = new PutItemCommand(params);
    await dynamoClient.send(command);

    return {
      statusCode: 201,
      body: {
        success: true,
        project
      }
    };
  } catch (error) {
    console.error('Error creating project:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: error.message || 'Failed to create project'
      }
    };
  }
}

/**
 * Update an existing project
 * PUT /api/projects/admin/:id
 */
async function handleUpdateProject(event, projectId) {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

    // First, get the existing project
    const getParams = {
      TableName: PROJECTS_TABLE,
      Key: marshall({ projectId })
    };

    const getCommand = new GetItemCommand(getParams);
    const existingResult = await dynamoClient.send(getCommand);

    if (!existingResult.Item) {
      return {
        statusCode: 404,
        body: {
          success: false,
          error: 'Project not found'
        }
      };
    }

    const existingProject = unmarshall(existingResult.Item);
    const now = new Date().toISOString();

    // Merge updates with existing project
    const updatedProject = {
      ...existingProject,
      ...body,
      projectId, // Ensure ID doesn't change
      updatedAt: now
    };

    // Save back to DynamoDB
    const putParams = {
      TableName: PROJECTS_TABLE,
      Item: marshall(updatedProject)
    };

    const putCommand = new PutItemCommand(putParams);
    await dynamoClient.send(putCommand);

    return {
      statusCode: 200,
      body: {
        success: true,
        project: updatedProject
      }
    };
  } catch (error) {
    console.error('Error updating project:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: error.message || 'Failed to update project'
      }
    };
  }
}

/**
 * Delete a project
 * DELETE /api/projects/admin/:id
 */
async function handleDeleteProject(event, projectId) {
  try {
    const params = {
      TableName: PROJECTS_TABLE,
      Key: marshall({ projectId })
    };

    const command = new DeleteItemCommand(params);
    await dynamoClient.send(command);

    return {
      statusCode: 200,
      body: {
        success: true,
        message: 'Project deleted successfully'
      }
    };
  } catch (error) {
    console.error('Error deleting project:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: error.message || 'Failed to delete project'
      }
    };
  }
}

/**
 * Update project status
 * PUT /api/projects/admin/:id/status
 */
async function handleUpdateProjectStatus(event, projectId) {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { status } = body;

    if (!status) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: 'Status is required'
        }
      };
    }

    // Get existing project
    const getParams = {
      TableName: PROJECTS_TABLE,
      Key: marshall({ projectId })
    };

    const getCommand = new GetItemCommand(getParams);
    const result = await dynamoClient.send(getCommand);

    if (!result.Item) {
      return {
        statusCode: 404,
        body: {
          success: false,
          error: 'Project not found'
        }
      };
    }

    const project = unmarshall(result.Item);
    project.status = status;
    project.updatedAt = new Date().toISOString();

    // Save back
    const putParams = {
      TableName: PROJECTS_TABLE,
      Item: marshall(project)
    };

    const putCommand = new PutItemCommand(putParams);
    await dynamoClient.send(putCommand);

    return {
      statusCode: 200,
      body: {
        success: true,
        project
      }
    };
  } catch (error) {
    console.error('Error updating project status:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: error.message || 'Failed to update project status'
      }
    };
  }
}

/**
 * Update project timeline
 * POST /api/projects/admin/:id/timeline
 */
async function handleUpdateProjectTimeline(event, projectId) {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { startDate, estimatedEndDate } = body;

    // Get existing project
    const getParams = {
      TableName: PROJECTS_TABLE,
      Key: marshall({ projectId })
    };

    const getCommand = new GetItemCommand(getParams);
    const result = await dynamoClient.send(getCommand);

    if (!result.Item) {
      return {
        statusCode: 404,
        body: {
          success: false,
          error: 'Project not found'
        }
      };
    }

    const project = unmarshall(result.Item);

    if (startDate) project.startDate = startDate;
    if (estimatedEndDate) project.estimatedEndDate = estimatedEndDate;
    project.updatedAt = new Date().toISOString();

    // Save back
    const putParams = {
      TableName: PROJECTS_TABLE,
      Item: marshall(project)
    };

    const putCommand = new PutItemCommand(putParams);
    await dynamoClient.send(putCommand);

    return {
      statusCode: 200,
      body: {
        success: true,
        project
      }
    };
  } catch (error) {
    console.error('Error updating project timeline:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: error.message || 'Failed to update project timeline'
      }
    };
  }
}

/**
 * Get all personnel (for dropdown/selection)
 * GET /api/personnel
 */
async function handleListPersonnel(event) {
  try {
    const params = {
      TableName: PERSONNEL_TABLE,
      FilterExpression: '#sk = :metadata',
      ExpressionAttributeNames: {
        '#sk': 'SK'
      },
      ExpressionAttributeValues: marshall({
        ':metadata': 'METADATA'
      })
    };

    const command = new ScanCommand(params);
    const result = await dynamoClient.send(command);

    const personnel = result.Items ? result.Items.map(item => {
      const person = unmarshall(item);
      return {
        id: person.personnel_id,
        name: person.full_name,
        role: person.role,
        status: person.status
      };
    }) : [];

    return {
      statusCode: 200,
      body: {
        success: true,
        personnel: personnel
      }
    };
  } catch (error) {
    console.error('Error listing personnel:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: error.message || 'Failed to list personnel'
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
  handleUpdateProjectTimeline,
  handleListPersonnel
};
