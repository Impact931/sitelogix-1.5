"use strict";
/**
 * Personnel Deduplication Service
 *
 * Smart deduplication to prevent duplicate employee records
 * Uses fuzzy name matching and nickname tracking
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersonnelDeduplicationService = void 0;
exports.getPersonnelDeduplicationService = getPersonnelDeduplicationService;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const uuid_1 = require("uuid");
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
const PERSONNEL_TABLE = process.env.PERSONNEL_TABLE || 'sitelogix-personnel';
class PersonnelDeduplicationService {
    /**
     * Normalize name for comparison
     */
    normalizeName(name) {
        return name
            .toLowerCase()
            .trim()
            .replace(/[^a-z\s]/g, '') // Remove special characters
            .replace(/\s+/g, ' '); // Normalize whitespace
    }
    /**
     * Calculate Levenshtein distance between two strings
     */
    levenshteinDistance(str1, str2) {
        const m = str1.length;
        const n = str2.length;
        const dp = Array(m + 1)
            .fill(null)
            .map(() => Array(n + 1).fill(0));
        for (let i = 0; i <= m; i++)
            dp[i][0] = i;
        for (let j = 0; j <= n; j++)
            dp[0][j] = j;
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1];
                }
                else {
                    dp[i][j] = Math.min(dp[i - 1][j] + 1, // deletion
                    dp[i][j - 1] + 1, // insertion
                    dp[i - 1][j - 1] + 1 // substitution
                    );
                }
            }
        }
        return dp[m][n];
    }
    /**
     * Calculate similarity score (0-100)
     */
    calculateSimilarity(str1, str2) {
        const distance = this.levenshteinDistance(str1, str2);
        const maxLength = Math.max(str1.length, str2.length);
        return ((maxLength - distance) / maxLength) * 100;
    }
    /**
     * Query personnel by normalized name
     */
    async queryByName(normalizedName) {
        try {
            const result = await docClient.send(new lib_dynamodb_1.QueryCommand({
                TableName: PERSONNEL_TABLE,
                IndexName: 'GSI1-NameIndex',
                KeyConditionExpression: 'full_name = :name',
                ExpressionAttributeValues: {
                    ':name': normalizedName
                },
                Limit: 1
            }));
            if (result.Items && result.Items.length > 0) {
                return result.Items[0];
            }
            return null;
        }
        catch (error) {
            console.error('Error querying personnel by name:', error);
            return null;
        }
    }
    /**
     * Fuzzy match by nickname/go-by name
     */
    async fuzzyMatchByNickname(goByName, fullName) {
        try {
            // Get all active personnel
            const result = await docClient.send(new lib_dynamodb_1.QueryCommand({
                TableName: PERSONNEL_TABLE,
                IndexName: 'GSI2-StatusIndex',
                KeyConditionExpression: '#status = :status',
                ExpressionAttributeNames: {
                    '#status': 'status'
                },
                ExpressionAttributeValues: {
                    ':status': 'active'
                }
            }));
            if (!result.Items || result.Items.length === 0) {
                return null;
            }
            const normalizedGoBy = this.normalizeName(goByName);
            const normalizedFull = this.normalizeName(fullName);
            // Find best match
            let bestMatch = null;
            let bestScore = 0;
            for (const item of result.Items) {
                const person = item;
                // Check nickname match
                for (const nickname of person.nicknames || []) {
                    const normalizedNickname = this.normalizeName(nickname);
                    const nicknameScore = this.calculateSimilarity(normalizedGoBy, normalizedNickname);
                    if (nicknameScore > 80 && nicknameScore > bestScore) {
                        // Also check if full names are similar
                        const fullNameScore = this.calculateSimilarity(normalizedFull, this.normalizeName(person.fullName));
                        if (fullNameScore > 60) {
                            bestScore = nicknameScore;
                            bestMatch = person;
                        }
                    }
                }
                // Check full name fuzzy match
                const fullNameScore = this.calculateSimilarity(normalizedFull, this.normalizeName(person.fullName));
                if (fullNameScore > 85 && fullNameScore > bestScore) {
                    bestScore = fullNameScore;
                    bestMatch = person;
                }
            }
            if (bestMatch) {
                console.log(`🔍 Found fuzzy match: "${fullName}" -> "${bestMatch.fullName}" (${bestScore.toFixed(1)}% match)`);
            }
            return bestMatch;
        }
        catch (error) {
            console.error('Error in fuzzy matching:', error);
            return null;
        }
    }
    /**
     * Create new personnel profile
     */
    async createPerson(fullName, goByName, position, reportDate, hoursWorked) {
        const personId = `person_${(0, uuid_1.v4)()}`;
        const normalizedName = this.normalizeName(fullName);
        const now = new Date().toISOString();
        const person = {
            personId,
            fullName: normalizedName,
            nicknames: [goByName, fullName, normalizedName],
            goByName,
            currentPosition: position,
            dateFirstSeen: reportDate,
            dateLastSeen: reportDate,
            totalReportsCount: 1,
            totalHoursWorked: hoursWorked,
            status: 'active',
            createdAt: now,
            updatedAt: now
        };
        await docClient.send(new lib_dynamodb_1.PutCommand({
            TableName: PERSONNEL_TABLE,
            Item: {
                PK: `PERSON#${personId}`,
                SK: 'PROFILE',
                ...person,
                full_name: normalizedName, // For GSI
                dateLastSeen: reportDate // For GSI
            }
        }));
        console.log(`✨ Created new person: ${fullName} (${personId})`);
        return person;
    }
    /**
     * Update existing personnel profile
     */
    async updatePerson(person, position, reportDate, hoursWorked, goByName) {
        const now = new Date().toISOString();
        // Add new nickname if not already in list
        const updatedNicknames = [...new Set([...person.nicknames, goByName])];
        const updatedPerson = {
            ...person,
            dateLastSeen: reportDate,
            totalReportsCount: person.totalReportsCount + 1,
            totalHoursWorked: person.totalHoursWorked + hoursWorked,
            currentPosition: position, // Update to latest position
            nicknames: updatedNicknames,
            updatedAt: now
        };
        await docClient.send(new lib_dynamodb_1.UpdateCommand({
            TableName: PERSONNEL_TABLE,
            Key: {
                PK: `PERSON#${person.personId}`,
                SK: 'PROFILE'
            },
            UpdateExpression: `
          SET dateLastSeen = :dateLastSeen,
              totalReportsCount = :totalReportsCount,
              totalHoursWorked = :totalHoursWorked,
              currentPosition = :currentPosition,
              nicknames = :nicknames,
              updatedAt = :updatedAt
        `,
            ExpressionAttributeValues: {
                ':dateLastSeen': reportDate,
                ':totalReportsCount': updatedPerson.totalReportsCount,
                ':totalHoursWorked': updatedPerson.totalHoursWorked,
                ':currentPosition': position,
                ':nicknames': updatedNicknames,
                ':updatedAt': now
            }
        }));
        console.log(`🔄 Updated person: ${person.fullName} (${person.personId})`);
        return updatedPerson;
    }
    /**
     * Create personnel history record
     */
    async createPersonnelHistory(personId, reportId, reportDate, projectId, projectName, position, teamAssignment, hoursWorked, overtimeHours, healthStatus, activitiesPerformed) {
        const timestamp = new Date().toISOString();
        await docClient.send(new lib_dynamodb_1.PutCommand({
            TableName: PERSONNEL_TABLE,
            Item: {
                PK: `PERSON#${personId}`,
                SK: `HISTORY#${reportId}#${timestamp}`,
                reportId,
                reportDate,
                projectId,
                projectName,
                position,
                teamAssignment,
                hoursWorked,
                overtimeHours,
                healthStatus,
                activitiesPerformed
            }
        }));
    }
    /**
     * Find or create person (main deduplication logic)
     */
    async findOrCreatePerson(fullName, goByName, position, teamAssignment, hoursWorked, overtimeHours, healthStatus, reportId, reportDate, projectId, projectName, activitiesPerformed) {
        try {
            // 1. Normalize name
            const normalizedName = this.normalizeName(fullName);
            // 2. Search by exact name match
            let person = await this.queryByName(normalizedName);
            // 3. If not found, fuzzy match on nicknames
            if (!person) {
                person = await this.fuzzyMatchByNickname(goByName, fullName);
            }
            // 4. If still not found, create new person
            if (!person) {
                person = await this.createPerson(fullName, goByName, position, reportDate, hoursWorked);
            }
            else {
                // 5. Update existing person
                person = await this.updatePerson(person, position, reportDate, hoursWorked, goByName);
            }
            // 6. Create history record
            await this.createPersonnelHistory(person.personId, reportId, reportDate, projectId, projectName, position, teamAssignment, hoursWorked, overtimeHours, healthStatus, activitiesPerformed);
            return person.personId;
        }
        catch (error) {
            console.error('Error in findOrCreatePerson:', error);
            throw error;
        }
    }
}
exports.PersonnelDeduplicationService = PersonnelDeduplicationService;
// Export singleton
let personnelServiceInstance = null;
function getPersonnelDeduplicationService() {
    if (!personnelServiceInstance) {
        personnelServiceInstance = new PersonnelDeduplicationService();
    }
    return personnelServiceInstance;
}
//# sourceMappingURL=personnelDeduplicationService.js.map