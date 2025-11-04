/**
 * Confidence Scoring Service
 *
 * Multi-signal confidence scoring for AI extractions
 * Implements RFC-008 confidence requirements
 */

export interface ConfidenceScore {
  overall: number;              // 0-100
  extractionConfidence: number; // AI model confidence
  matchConfidence: number;      // Entity matching confidence
  historicalConfidence: number; // Pattern consistency
  anomalyScore: number;         // Deviation from norm (0-100)
  requiresReview: boolean;
  reviewReason?: string;
}

export interface PersonnelExtractionConfidence {
  nameConfidence: number;
  positionConfidence: number;
  hoursConfidence: number;
  matchConfidence: number;
}

export interface VendorExtractionConfidence {
  companyNameConfidence: number;
  deliveryDetailConfidence: number;
  matchConfidence: number;
}

export interface ConstraintExtractionConfidence {
  categorySeverityConfidence: number;
  descriptionQualityConfidence: number;
}

export class ConfidenceScoringService {

  /**
   * Calculate overall confidence score
   */
  calculateOverallConfidence(
    extractionConf: number,
    matchConf: number,
    historicalConf: number,
    anomalyScore: number
  ): number {
    // Weighted average with anomaly penalty
    const baseScore = (
      extractionConf * 0.40 +
      matchConf * 0.35 +
      historicalConf * 0.25
    );

    // Apply anomaly penalty (high anomaly reduces confidence)
    const anomalyPenalty = (anomalyScore / 100) * 15;

    return Math.max(0, Math.min(100, baseScore - anomalyPenalty));
  }

  /**
   * Calculate personnel extraction confidence
   */
  calculatePersonnelConfidence(
    person: {
      fullName: string;
      goByName: string;
      position: string;
      hoursWorked: number;
      overtimeHours: number;
      extractedFromText: string;
    },
    matchScore: number
  ): PersonnelExtractionConfidence {

    return {
      nameConfidence: this.calculateNameConfidence(
        person.fullName,
        person.goByName,
        person.extractedFromText
      ),
      positionConfidence: this.calculatePositionConfidence(
        person.position,
        person.extractedFromText
      ),
      hoursConfidence: this.calculateHoursConfidence(
        person.hoursWorked,
        person.overtimeHours,
        person.extractedFromText
      ),
      matchConfidence: matchScore
    };
  }

  /**
   * Name confidence algorithm
   */
  private calculateNameConfidence(
    fullName: string,
    goByName: string,
    extractedText: string
  ): number {
    let score = 100;

    // Penalty for single-name extractions
    if (!fullName.includes(' ')) {
      score -= 20;
    }

    // Penalty for very short names
    if (fullName.length < 3) {
      score -= 30;
    }

    // Bonus for multiple mentions
    const mentionCount = extractedText.toLowerCase()
      .split(goByName.toLowerCase()).length - 1;
    if (mentionCount > 1) {
      score += 10;
    }

    // Penalty for unusual characters
    if (/[0-9!@#$%^&*()]/.test(fullName)) {
      score -= 40;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Position confidence algorithm
   */
  private calculatePositionConfidence(
    position: string,
    extractedText: string
  ): number {
    const validPositions = [
      'Project Manager',
      'Foreman',
      'Journeyman',
      'Apprentice',
      'Superintendent',
      'Laborer'
    ];

    // Exact match with valid positions
    if (validPositions.includes(position)) {
      return 95;
    }

    // Fuzzy match with valid positions
    for (const validPos of validPositions) {
      const similarity = this.calculateStringSimilarity(position, validPos);
      if (similarity > 80) {
        return 75;
      }
    }

    // Check if position mentioned in transcript
    if (extractedText.toLowerCase().includes(position.toLowerCase())) {
      return 60;
    }

    return 40;
  }

  /**
   * Hours confidence algorithm
   */
  private calculateHoursConfidence(
    hoursWorked: number,
    overtimeHours: number,
    extractedText: string
  ): number {
    let score = 100;

    // Unrealistic hours
    if (hoursWorked > 16 || hoursWorked < 0) {
      score -= 50;
    }

    if (overtimeHours > 8 || overtimeHours < 0) {
      score -= 30;
    }

    // Typical workday validation
    const totalHours = hoursWorked + overtimeHours;
    if (totalHours > 12 && totalHours <= 16) {
      score -= 10;
    }

    // Check for explicit hour mention
    const hourPattern = /(\d+)\s*(hour|hr|hrs)/i;
    if (hourPattern.test(extractedText)) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate vendor extraction confidence
   */
  calculateVendorConfidence(
    vendor: {
      companyName: string;
      materialsDelivered: string;
      deliveryTime?: string;
      receivedBy?: string;
      extractedFromText: string;
    },
    matchScore: number
  ): VendorExtractionConfidence {

    return {
      companyNameConfidence: this.calculateCompanyNameConfidence(
        vendor.companyName,
        vendor.extractedFromText
      ),
      deliveryDetailConfidence: this.calculateDeliveryDetailConfidence(
        vendor.materialsDelivered,
        vendor.deliveryTime,
        vendor.receivedBy
      ),
      matchConfidence: matchScore
    };
  }

  /**
   * Company name confidence
   */
  private calculateCompanyNameConfidence(
    companyName: string,
    extractedText: string
  ): number {
    let score = 100;

    // Too short
    if (companyName.length < 3) {
      score -= 40;
    }

    // Contains company suffixes
    const companySuffixes = ['Inc', 'LLC', 'Corp', 'Ltd', 'Co'];
    const hasSuffix = companySuffixes.some(suffix =>
      companyName.includes(suffix)
    );
    if (hasSuffix) {
      score += 15;
    }

    // Generic names
    const genericNames = ['vendor', 'supplier', 'company', 'delivery'];
    const isGeneric = genericNames.some(term =>
      companyName.toLowerCase().includes(term)
    );
    if (isGeneric) {
      score -= 30;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Delivery detail confidence
   */
  private calculateDeliveryDetailConfidence(
    materialsDelivered: string,
    deliveryTime?: string,
    receivedBy?: string
  ): number {
    let score = 60; // Base score

    // Has materials description
    if (materialsDelivered && materialsDelivered.length > 5) {
      score += 20;
    }

    // Has delivery time
    if (deliveryTime) {
      score += 10;
    }

    // Has receiver
    if (receivedBy) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate constraint extraction confidence
   */
  calculateConstraintConfidence(
    constraint: {
      category: string;
      severity: string;
      description: string;
      extractedFromText: string;
    }
  ): ConstraintExtractionConfidence {

    return {
      categorySeverityConfidence: this.calculateCategorySeverityConfidence(
        constraint.category,
        constraint.severity,
        constraint.description
      ),
      descriptionQualityConfidence: this.calculateDescriptionQuality(
        constraint.description,
        constraint.extractedFromText
      )
    };
  }

  /**
   * Category severity confidence
   */
  private calculateCategorySeverityConfidence(
    category: string,
    severity: string,
    description: string
  ): number {
    let score = 100;

    // Valid category check
    const validCategories = ['delay', 'safety', 'material', 'weather', 'labor', 'coordination', 'other'];
    if (!validCategories.includes(category)) {
      score -= 30;
    }

    // Valid severity check
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!validSeverities.includes(severity)) {
      score -= 30;
    }

    // Severity-category alignment
    const safetyKeywords = ['injury', 'accident', 'unsafe', 'hazard', 'danger'];
    const isSafetyRelated = safetyKeywords.some(kw =>
      description.toLowerCase().includes(kw)
    );

    if (isSafetyRelated && category === 'safety') {
      score += 10;
    } else if (isSafetyRelated && category !== 'safety') {
      score -= 20;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Description quality confidence
   */
  private calculateDescriptionQuality(
    description: string,
    extractedText: string
  ): number {
    let score = 100;

    // Too short
    if (description.length < 10) {
      score -= 40;
    }

    // Good length
    if (description.length > 30 && description.length < 500) {
      score += 10;
    }

    // Contains actionable information
    const actionableKeywords = ['need', 'require', 'must', 'waiting', 'blocked', 'issue'];
    const hasActionable = actionableKeywords.some(kw =>
      description.toLowerCase().includes(kw)
    );
    if (hasActionable) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Determine if review is required
   */
  shouldRequireReview(
    overallConfidence: number,
    entityType: 'personnel' | 'vendor' | 'constraint',
    extractionDetails: any
  ): { requiresReview: boolean; reason?: string } {

    // Critical issues always require review
    if (entityType === 'constraint' && extractionDetails.severity === 'critical') {
      return {
        requiresReview: true,
        reason: 'Critical safety or project issue detected'
      };
    }

    // Low confidence requires review
    if (overallConfidence < 60) {
      return {
        requiresReview: true,
        reason: `Low confidence score: ${overallConfidence.toFixed(1)}%`
      };
    }

    // Medium confidence for new entities
    if (overallConfidence < 85 && extractionDetails.isNewEntity) {
      return {
        requiresReview: true,
        reason: `New ${entityType} with moderate confidence`
      };
    }

    return { requiresReview: false };
  }

  /**
   * Simple string similarity (Levenshtein-based)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
    const maxLength = Math.max(str1.length, str2.length);
    return ((maxLength - distance) / maxLength) * 100;
  }

  /**
   * Levenshtein distance
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
            dp[i - 1][j] + 1,
            dp[i][j - 1] + 1,
            dp[i - 1][j - 1] + 1
          );
        }
      }
    }

    return dp[m][n];
  }
}

// Export singleton
let confidenceScoringServiceInstance: ConfidenceScoringService | null = null;

export function getConfidenceScoringService(): ConfidenceScoringService {
  if (!confidenceScoringServiceInstance) {
    confidenceScoringServiceInstance = new ConfidenceScoringService();
  }
  return confidenceScoringServiceInstance;
}
