/**
 * Personnel Deduplication Service
 *
 * Smart deduplication to prevent duplicate employee records
 * Uses fuzzy name matching and nickname tracking
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const PERSONNEL_TABLE = process.env.PERSONNEL_TABLE || 'sitelogix-personnel';

interface PersonnelProfile {
  personId: string;
  fullName: string;
  nicknames: string[];
  goByName: string;
  currentPosition: string;
  dateFirstSeen: string;
  dateLastSeen: string;
  totalReportsCount: number;
  totalHoursWorked: number;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string;
  updatedAt: string;
}

interface PersonnelHistory {
  personId: string;
  reportId: string;
  reportDate: string;
  projectId: string;
  projectName: string;
  position: string;
  teamAssignment: string;
  hoursWorked: number;
  overtimeHours: number;
  healthStatus: string;
  activitiesPerformed?: string;
}

export class PersonnelDeduplicationService {
  /**
   * Normalize name for comparison
   */
  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1, // deletion
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
  private calculateSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return ((maxLength - distance) / maxLength) * 100;
  }

  /**
   * Query personnel by normalized name
   */
  private async queryByName(normalizedName: string): Promise<PersonnelProfile | null> {
    try {
      const result = await docClient.send(
        new QueryCommand({
          TableName: PERSONNEL_TABLE,
          IndexName: 'GSI1-NameIndex',
          KeyConditionExpression: 'full_name = :name',
          ExpressionAttributeValues: {
            ':name': normalizedName
          },
          Limit: 1
        })
      );

      if (result.Items && result.Items.length > 0) {
        return result.Items[0] as PersonnelProfile;
      }

      return null;
    } catch (error) {
      console.error('Error querying personnel by name:', error);
      return null;
    }
  }

  /**
   * Fuzzy match by nickname/go-by name
   */
  private async fuzzyMatchByNickname(
    goByName: string,
    fullName: string
  ): Promise<PersonnelProfile | null> {
    try {
      // Get all active personnel
      const result = await docClient.send(
        new QueryCommand({
          TableName: PERSONNEL_TABLE,
          IndexName: 'GSI2-StatusIndex',
          KeyConditionExpression: '#status = :status',
          ExpressionAttributeNames: {
            '#status': 'status'
          },
          ExpressionAttributeValues: {
            ':status': 'active'
          }
        })
      );

      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      const normalizedGoBy = this.normalizeName(goByName);
      const normalizedFull = this.normalizeName(fullName);

      // Find best match
      let bestMatch: PersonnelProfile | null = null;
      let bestScore = 0;

      for (const item of result.Items) {
        const person = item as PersonnelProfile;

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
    } catch (error) {
      console.error('Error in fuzzy matching:', error);
      return null;
    }
  }

  /**
   * Create new personnel profile
   */
  private async createPerson(
    fullName: string,
    goByName: string,
    position: string,
    reportDate: string,
    hoursWorked: number
  ): Promise<PersonnelProfile> {
    const personId = `person_${uuidv4()}`;
    const normalizedName = this.normalizeName(fullName);
    const now = new Date().toISOString();

    const person: PersonnelProfile = {
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

    await docClient.send(
      new PutCommand({
        TableName: PERSONNEL_TABLE,
        Item: {
          PK: `PERSON#${personId}`,
          SK: 'PROFILE',
          ...person,
          full_name: normalizedName, // For GSI
          dateLastSeen: reportDate // For GSI
        }
      })
    );

    console.log(`✨ Created new person: ${fullName} (${personId})`);
    return person;
  }

  /**
   * Update existing personnel profile
   */
  private async updatePerson(
    person: PersonnelProfile,
    position: string,
    reportDate: string,
    hoursWorked: number,
    goByName: string
  ): Promise<PersonnelProfile> {
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

    await docClient.send(
      new UpdateCommand({
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
      })
    );

    console.log(`🔄 Updated person: ${person.fullName} (${person.personId})`);
    return updatedPerson;
  }

  /**
   * Create personnel history record
   */
  private async createPersonnelHistory(
    personId: string,
    reportId: string,
    reportDate: string,
    projectId: string,
    projectName: string,
    position: string,
    teamAssignment: string,
    hoursWorked: number,
    overtimeHours: number,
    healthStatus: string,
    activitiesPerformed?: string
  ): Promise<void> {
    const timestamp = new Date().toISOString();

    await docClient.send(
      new PutCommand({
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
      })
    );
  }

  /**
   * Find or create person (main deduplication logic)
   */
  async findOrCreatePerson(
    fullName: string,
    goByName: string,
    position: string,
    teamAssignment: string,
    hoursWorked: number,
    overtimeHours: number,
    healthStatus: string,
    reportId: string,
    reportDate: string,
    projectId: string,
    projectName: string,
    activitiesPerformed?: string
  ): Promise<string> {
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
      } else {
        // 5. Update existing person
        person = await this.updatePerson(person, position, reportDate, hoursWorked, goByName);
      }

      // 6. Create history record
      await this.createPersonnelHistory(
        person.personId,
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
      );

      return person.personId;
    } catch (error) {
      console.error('Error in findOrCreatePerson:', error);
      throw error;
    }
  }
}

// Export singleton
let personnelServiceInstance: PersonnelDeduplicationService | null = null;

export function getPersonnelDeduplicationService(): PersonnelDeduplicationService {
  if (!personnelServiceInstance) {
    personnelServiceInstance = new PersonnelDeduplicationService();
  }
  return personnelServiceInstance;
}
