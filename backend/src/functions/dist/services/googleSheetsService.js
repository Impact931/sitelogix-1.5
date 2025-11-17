"use strict";
/**
 * Google Sheets Service - OAuth 2.0 Integration
 *
 * Uses OAuth 2.0 for user authentication (not service account)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleSheetsService = void 0;
exports.initializeGoogleSheetsService = initializeGoogleSheetsService;
exports.getGoogleSheetsService = getGoogleSheetsService;
const googleapis_1 = require("googleapis");
class GoogleSheetsService {
    constructor(config) {
        // Create OAuth2 client
        this.oauth2Client = new googleapis_1.google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
        // Set refresh token
        this.oauth2Client.setCredentials({
            refresh_token: config.refreshToken
        });
        // Initialize Google Sheets API
        this.sheets = googleapis_1.google.sheets({ version: 'v4', auth: this.oauth2Client });
    }
    /**
     * Generate OAuth URL for initial authorization
     */
    static getAuthUrl(clientId, clientSecret, redirectUri) {
        const oauth2Client = new googleapis_1.google.auth.OAuth2(clientId, clientSecret, redirectUri);
        const scopes = [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive.file'
        ];
        return oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent' // Force consent to get refresh token
        });
    }
    /**
     * Exchange authorization code for tokens
     */
    static async getTokensFromCode(code, clientId, clientSecret, redirectUri) {
        const oauth2Client = new googleapis_1.google.auth.OAuth2(clientId, clientSecret, redirectUri);
        const { tokens } = await oauth2Client.getToken(code);
        return {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token
        };
    }
    /**
     * Extract spreadsheet ID from URL
     */
    extractSpreadsheetId(url) {
        const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (!match) {
            throw new Error('Invalid Google Sheets URL');
        }
        return match[1];
    }
    /**
     * Create a new sheet for the report date if it doesn't exist
     */
    async createSheetIfNotExists(spreadsheetId, sheetName) {
        try {
            // Get existing sheets
            const response = await this.sheets.spreadsheets.get({
                spreadsheetId
            });
            const existingSheet = response.data.sheets?.find((sheet) => sheet.properties.title === sheetName);
            if (existingSheet) {
                return existingSheet.properties.sheetId;
            }
            // Create new sheet
            const addSheetResponse = await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: [
                        {
                            addSheet: {
                                properties: {
                                    title: sheetName
                                }
                            }
                        }
                    ]
                }
            });
            return addSheetResponse.data.replies[0].addSheet.properties.sheetId;
        }
        catch (error) {
            console.error('Error creating sheet:', error);
            throw error;
        }
    }
    /**
     * Apply template formatting to match Parkway Construction format
     */
    async applyTemplateFormatting(spreadsheetId, sheetId, sheetName) {
        try {
            const requests = [
                // Header background (gold/orange gradient)
                {
                    repeatCell: {
                        range: {
                            sheetId,
                            startRowIndex: 0,
                            endRowIndex: 3,
                            startColumnIndex: 0,
                            endColumnIndex: 13
                        },
                        cell: {
                            userEnteredFormat: {
                                backgroundColor: {
                                    red: 1.0,
                                    green: 0.75,
                                    blue: 0.0
                                },
                                textFormat: {
                                    bold: true,
                                    fontSize: 14
                                }
                            }
                        },
                        fields: 'userEnteredFormat(backgroundColor,textFormat)'
                    }
                },
                // Column headers background
                {
                    repeatCell: {
                        range: {
                            sheetId,
                            startRowIndex: 6,
                            endRowIndex: 7,
                            startColumnIndex: 0,
                            endColumnIndex: 13
                        },
                        cell: {
                            userEnteredFormat: {
                                backgroundColor: {
                                    red: 0.85,
                                    green: 0.85,
                                    blue: 0.85
                                },
                                textFormat: {
                                    bold: true
                                },
                                horizontalAlignment: 'CENTER'
                            }
                        },
                        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
                    }
                },
                // Freeze header rows
                {
                    updateSheetProperties: {
                        properties: {
                            sheetId,
                            gridProperties: {
                                frozenRowCount: 7
                            }
                        },
                        fields: 'gridProperties.frozenRowCount'
                    }
                },
                // Set column widths
                {
                    updateDimensionProperties: {
                        range: {
                            sheetId,
                            dimension: 'COLUMNS',
                            startIndex: 0,
                            endIndex: 1
                        },
                        properties: {
                            pixelSize: 150
                        },
                        fields: 'pixelSize'
                    }
                }
            ];
            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: { requests }
            });
        }
        catch (error) {
            console.error('Error applying formatting:', error);
            // Don't throw - formatting is nice to have but not critical
        }
    }
    /**
     * Write daily report to Google Sheets
     */
    async writeDailyReport(spreadsheetUrl, reportData) {
        try {
            const spreadsheetId = this.extractSpreadsheetId(spreadsheetUrl);
            const sheetName = reportData.reportDate; // Use date as sheet name
            // Create sheet if needed
            const sheetId = await this.createSheetIfNotExists(spreadsheetId, sheetName);
            // Build data arrays
            const headerData = [
                ['', '', '', 'Parkway Construction Services', '', '', '', `Date:${reportData.reportDate}`],
                ['', '', '', '', '', '', '', ''],
                ['', '', '', reportData.projectName, '', '', '', '']
            ];
            const columnHeaders = [
                ['Full Name', 'Go By', 'Position', 'Team #', 'Limitations', 'Hours', 'O/T']
            ];
            const personnelRows = reportData.personnel.map(p => [
                p.fullName,
                p.goByName,
                p.position,
                p.teamAssignment,
                p.healthStatus || 'Healthy',
                p.hoursWorked || 0,
                p.overtimeHours || 0
            ]);
            const totalRow = [
                [`Total pax:`, reportData.totalHeadcount, '', '', '', '', '', '', '', '', '', 'Regular', 'Overtime'],
                ['', '', '', '', '', '', '', '', '', '', 'Total Hours:', reportData.totalRegularHours, reportData.totalOvertimeHours]
            ];
            const tasksSectionHeader = [
                ['', '', '', '', 'TASKS', '', '', '', 'CONSTRAINTS BY LEVEL']
            ];
            const tasksHeaders = [
                ['Team', '', 'Task:', '', '', '', '', 'Level', 'Constraint']
            ];
            const maxRows = Math.max(reportData.workLogs.length, reportData.constraints.length);
            const tasksAndConstraintsRows = [];
            for (let i = 0; i < maxRows; i++) {
                const workLog = reportData.workLogs[i];
                const constraint = reportData.constraints[i];
                tasksAndConstraintsRows.push([
                    workLog?.teamId || '',
                    '',
                    workLog?.taskDescription || '',
                    '',
                    '',
                    '',
                    '',
                    constraint?.level || '',
                    constraint?.description || ''
                ]);
            }
            // Write all data in batches
            const updates = [
                // Header
                {
                    range: `${sheetName}!A1:H3`,
                    values: headerData
                },
                // Column headers
                {
                    range: `${sheetName}!A7:G7`,
                    values: columnHeaders
                },
                // Personnel data
                {
                    range: `${sheetName}!A8:G${7 + personnelRows.length}`,
                    values: personnelRows
                },
                // Total row
                {
                    range: `${sheetName}!A${8 + personnelRows.length}:M${9 + personnelRows.length}`,
                    values: totalRow
                },
                // Tasks section header
                {
                    range: `${sheetName}!A${12 + personnelRows.length}:I${12 + personnelRows.length}`,
                    values: tasksSectionHeader
                },
                // Tasks headers
                {
                    range: `${sheetName}!A${14 + personnelRows.length}:I${14 + personnelRows.length}`,
                    values: tasksHeaders
                },
                // Tasks and constraints data
                {
                    range: `${sheetName}!A${15 + personnelRows.length}:I${14 + personnelRows.length + tasksAndConstraintsRows.length}`,
                    values: tasksAndConstraintsRows
                }
            ];
            await this.sheets.spreadsheets.values.batchUpdate({
                spreadsheetId,
                requestBody: {
                    valueInputOption: 'RAW',
                    data: updates
                }
            });
            // Apply formatting
            await this.applyTemplateFormatting(spreadsheetId, sheetId, sheetName);
            console.log(`✅ Report written to Google Sheets: ${sheetName}`);
        }
        catch (error) {
            console.error('Error writing to Google Sheets:', error);
            throw error;
        }
    }
    /**
     * Test connection and permissions
     */
    async testConnection(spreadsheetUrl) {
        try {
            const spreadsheetId = this.extractSpreadsheetId(spreadsheetUrl);
            const response = await this.sheets.spreadsheets.get({
                spreadsheetId
            });
            console.log(`✅ Successfully connected to: ${response.data.properties?.title}`);
            return true;
        }
        catch (error) {
            console.error('❌ Connection test failed:', error);
            return false;
        }
    }
}
exports.GoogleSheetsService = GoogleSheetsService;
// Export singleton instance
let sheetsServiceInstance = null;
function initializeGoogleSheetsService(config) {
    sheetsServiceInstance = new GoogleSheetsService(config);
    return sheetsServiceInstance;
}
function getGoogleSheetsService() {
    if (!sheetsServiceInstance) {
        throw new Error('Google Sheets service not initialized. Call initializeGoogleSheetsService first.');
    }
    return sheetsServiceInstance;
}
//# sourceMappingURL=googleSheetsService.js.map