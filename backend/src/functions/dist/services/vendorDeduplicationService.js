"use strict";
/**
 * Vendor Deduplication Service
 *
 * Smart deduplication for vendors/suppliers/subcontractors
 * Normalizes company names and tracks delivery history
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorDeduplicationService = void 0;
exports.getVendorDeduplicationService = getVendorDeduplicationService;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const uuid_1 = require("uuid");
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
const VENDORS_TABLE = process.env.VENDORS_TABLE || 'sitelogix-vendors';
class VendorDeduplicationService {
    /**
     * Normalize company name for comparison
     */
    normalizeCompanyName(name) {
        return name
            .toLowerCase()
            .trim()
            // Remove common suffixes
            .replace(/\s+(inc|llc|corp|corporation|company|co|ltd|limited)\b\.?/gi, '')
            // Remove special characters except spaces
            .replace(/[^a-z0-9\s]/g, '')
            // Normalize whitespace
            .replace(/\s+/g, ' ')
            .trim();
    }
    /**
     * Calculate Levenshtein distance
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
                    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + 1);
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
     * Query vendor by normalized company name
     */
    async queryByCompanyName(normalizedName) {
        try {
            const result = await docClient.send(new lib_dynamodb_1.QueryCommand({
                TableName: VENDORS_TABLE,
                IndexName: 'GSI1-CompanyIndex',
                KeyConditionExpression: 'company_name = :name',
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
            console.error('Error querying vendor by name:', error);
            return null;
        }
    }
    /**
     * Fuzzy match company name against existing vendors
     */
    async fuzzyMatchCompanyName(normalizedName) {
        try {
            // Get all active vendors
            const result = await docClient.send(new lib_dynamodb_1.QueryCommand({
                TableName: VENDORS_TABLE,
                IndexName: 'GSI2-TypeIndex',
                KeyConditionExpression: 'vendor_type = :type',
                ExpressionAttributeValues: {
                    ':type': 'supplier' // Start with suppliers, could expand
                }
            }));
            if (!result.Items || result.Items.length === 0) {
                return null;
            }
            let bestMatch = null;
            let bestScore = 0;
            for (const item of result.Items) {
                const vendor = item;
                // Check against primary company name
                const primaryScore = this.calculateSimilarity(normalizedName, this.normalizeCompanyName(vendor.companyName));
                if (primaryScore > 85 && primaryScore > bestScore) {
                    bestScore = primaryScore;
                    bestMatch = vendor;
                }
                // Check against name variations
                for (const variation of vendor.companyNameVariations || []) {
                    const variationScore = this.calculateSimilarity(normalizedName, this.normalizeCompanyName(variation));
                    if (variationScore > 85 && variationScore > bestScore) {
                        bestScore = variationScore;
                        bestMatch = vendor;
                    }
                }
            }
            if (bestMatch) {
                console.log(`🔍 Found fuzzy vendor match: "${normalizedName}" -> "${bestMatch.companyName}" (${bestScore.toFixed(1)}% match)`);
            }
            return bestMatch;
        }
        catch (error) {
            console.error('Error in vendor fuzzy matching:', error);
            return null;
        }
    }
    /**
     * Create new vendor profile
     */
    async createVendor(companyName, vendorType, reportDate) {
        const vendorId = `vendor_${(0, uuid_1.v4)()}`;
        const normalizedName = this.normalizeCompanyName(companyName);
        const now = new Date().toISOString();
        const vendor = {
            vendorId,
            companyName: normalizedName,
            companyNameVariations: [companyName, normalizedName],
            vendorType,
            dateFirstSeen: reportDate,
            dateLastSeen: reportDate,
            totalDeliveriesCount: 1,
            status: 'active',
            createdAt: now,
            updatedAt: now
        };
        await docClient.send(new lib_dynamodb_1.PutCommand({
            TableName: VENDORS_TABLE,
            Item: {
                PK: `VENDOR#${vendorId}`,
                SK: 'PROFILE',
                ...vendor,
                company_name: normalizedName, // For GSI
                vendor_type: vendorType, // For GSI
                dateLastSeen: reportDate // For GSI
            }
        }));
        console.log(`✨ Created new vendor: ${companyName} (${vendorId})`);
        return vendor;
    }
    /**
     * Update existing vendor profile
     */
    async updateVendor(vendor, reportDate, originalCompanyName) {
        const now = new Date().toISOString();
        // Add new name variation if not already in list
        const updatedVariations = [...new Set([...vendor.companyNameVariations, originalCompanyName])];
        const updatedVendor = {
            ...vendor,
            dateLastSeen: reportDate,
            totalDeliveriesCount: vendor.totalDeliveriesCount + 1,
            companyNameVariations: updatedVariations,
            updatedAt: now
        };
        await docClient.send(new lib_dynamodb_1.UpdateCommand({
            TableName: VENDORS_TABLE,
            Key: {
                PK: `VENDOR#${vendor.vendorId}`,
                SK: 'PROFILE'
            },
            UpdateExpression: `
          SET dateLastSeen = :dateLastSeen,
              totalDeliveriesCount = :totalDeliveriesCount,
              companyNameVariations = :companyNameVariations,
              updatedAt = :updatedAt
        `,
            ExpressionAttributeValues: {
                ':dateLastSeen': reportDate,
                ':totalDeliveriesCount': updatedVendor.totalDeliveriesCount,
                ':companyNameVariations': updatedVariations,
                ':updatedAt': now
            }
        }));
        console.log(`🔄 Updated vendor: ${vendor.companyName} (${vendor.vendorId})`);
        return updatedVendor;
    }
    /**
     * Create vendor delivery record
     */
    async createVendorDelivery(vendorId, reportId, reportDate, projectId, projectName, materialsDelivered, deliveryTime, receivedBy, deliveryNotes, extractedFromText) {
        const timestamp = new Date().toISOString();
        await docClient.send(new lib_dynamodb_1.PutCommand({
            TableName: VENDORS_TABLE,
            Item: {
                PK: `VENDOR#${vendorId}`,
                SK: `DELIVERY#${reportId}#${timestamp}`,
                reportId,
                reportDate,
                projectId,
                projectName,
                materialsDelivered,
                deliveryTime,
                receivedBy,
                deliveryNotes,
                extractedFromText
            }
        }));
    }
    /**
     * Find or create vendor (main deduplication logic)
     */
    async findOrCreateVendor(companyName, vendorType, materialsDelivered, deliveryTime, receivedBy, deliveryNotes, extractedFromText, reportId, reportDate, projectId, projectName) {
        try {
            // 1. Normalize company name
            const normalizedName = this.normalizeCompanyName(companyName);
            // 2. Search by exact match
            let vendor = await this.queryByCompanyName(normalizedName);
            // 3. If not found, fuzzy match on variations
            if (!vendor) {
                vendor = await this.fuzzyMatchCompanyName(normalizedName);
            }
            // 4. If still not found, create new vendor
            if (!vendor) {
                vendor = await this.createVendor(companyName, vendorType, reportDate);
            }
            else {
                // 5. Update existing vendor
                vendor = await this.updateVendor(vendor, reportDate, companyName);
            }
            // 6. Create delivery record
            await this.createVendorDelivery(vendor.vendorId, reportId, reportDate, projectId, projectName, materialsDelivered, deliveryTime, receivedBy, deliveryNotes, extractedFromText);
            return vendor.vendorId;
        }
        catch (error) {
            console.error('Error in findOrCreateVendor:', error);
            throw error;
        }
    }
}
exports.VendorDeduplicationService = VendorDeduplicationService;
// Export singleton
let vendorServiceInstance = null;
function getVendorDeduplicationService() {
    if (!vendorServiceInstance) {
        vendorServiceInstance = new VendorDeduplicationService();
    }
    return vendorServiceInstance;
}
//# sourceMappingURL=vendorDeduplicationService.js.map