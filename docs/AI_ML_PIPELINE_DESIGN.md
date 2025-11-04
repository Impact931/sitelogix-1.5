# SiteLogix AI/ML Production Pipeline Design
## RFC-008 Implementation Specification

**Version:** 2.0
**Date:** November 4, 2025
**Author:** Data Science Team
**Status:** Production Ready

---

## Executive Summary

This document specifies the production-grade AI/ML pipeline for SiteLogix 1.5, implementing RFC-008 requirements with confidence scoring, model versioning, entity resolution at 90%+ precision, and bulk reprocessing capabilities.

**Current Gaps:**
- No confidence scoring on extractions
- No model versioning strategy
- Missing phonetic/nickname matching
- No admin approval workflow for uncertain matches
- No bulk reprocessing capability
- Predictive analytics not implemented

**This Design Addresses:**
- Complete 6-stage AI processing pipeline
- Confidence scoring algorithms per entity type
- Model versioning with tagging and rollback
- Enhanced fuzzy matching with phonetics
- Admin workflow state machine
- Bulk reprocessing architecture
- Phase 3 predictive analytics foundation

---

## I. 6-Stage AI Processing Pipeline

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    STAGE 1: Transcript Ingestion                    │
│  ElevenLabs → S3 Storage → DynamoDB Reports Table                   │
│  Status: pending_analysis                                           │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│               STAGE 2: Structured Data Extraction                   │
│  AI Model (Claude 3.5 Sonnet) → JSON Output + Confidence Scores     │
│  Extract: Personnel, Work Logs, Constraints, Vendors                │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  STAGE 3: Entity Resolution                         │
│  Fuzzy Matching (Levenshtein + Phonetic + Nickname DB)              │
│  - Personnel Deduplication (90%+ precision)                         │
│  - Vendor Deduplication (85%+ precision)                            │
│  - Output: Match confidence + matched entity ID                     │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│               STAGE 4: Confidence Assessment                        │
│  Multi-Signal Confidence Scoring:                                   │
│  - AI extraction confidence                                         │
│  - Entity match confidence                                          │
│  - Historical pattern confidence                                    │
│  - Anomaly detection flags                                          │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│              STAGE 5: Admin Approval Routing                        │
│  Decision Logic:                                                    │
│  - High Confidence (>85%) → Auto-approve                            │
│  - Medium Confidence (60-85%) → Queue for review                    │
│  - Low Confidence (<60%) → Manual review required                   │
│  - Critical Issues → Immediate escalation                           │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│           STAGE 6: Data Persistence & Analytics Cache               │
│  - Write to DynamoDB tables                                         │
│  - Cache AI analysis results                                        │
│  - Update aggregate metrics                                         │
│  - Trigger downstream workflows                                     │
│  Status: analyzed (or pending_review)                               │
└─────────────────────────────────────────────────────────────────────┘
```

### Lambda Function Architecture

```typescript
// Stage 1: Triggered by S3 upload
Lambda: process-transcript-upload
  - Validates transcript format
  - Stores metadata in DynamoDB
  - Triggers Stage 2

// Stage 2: AI Extraction
Lambda: ai-extraction-orchestrator
  - Fetches transcript from S3
  - Calls AI model with versioned prompt
  - Parses and validates JSON response
  - Calculates extraction confidence
  - Triggers Stage 3

// Stage 3: Entity Resolution
Lambda: entity-resolution-engine
  - Personnel deduplication service
  - Vendor deduplication service
  - Fuzzy matching with phonetics
  - Outputs match candidates with scores
  - Triggers Stage 4

// Stage 4: Confidence Scoring
Lambda: confidence-scoring-engine
  - Multi-signal confidence calculation
  - Anomaly detection
  - Historical pattern analysis
  - Triggers Stage 5

// Stage 5: Admin Routing
Lambda: admin-workflow-router
  - Routing logic based on confidence
  - SQS queue for manual review
  - SNS notifications for critical issues
  - Triggers Stage 6

// Stage 6: Data Persistence
Lambda: data-persistence-handler
  - Writes to DynamoDB tables
  - Caches AI analysis
  - Updates metrics
  - Marks report complete
```

---

## II. Confidence Scoring Specifications

### 2.1 Overall Confidence Scoring Model

```typescript
interface ConfidenceScore {
  overall: number;           // 0-100
  extractionConfidence: number;  // AI model confidence
  matchConfidence: number;       // Entity matching confidence
  historicalConfidence: number;  // Pattern consistency
  anomalyScore: number;          // Deviation from norm (0-100, higher = more anomalous)
  requiresReview: boolean;       // Auto-flag for admin review
  reviewReason?: string;         // Why flagged
}

function calculateOverallConfidence(
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
```

### 2.2 Personnel Extraction Confidence

```typescript
interface PersonnelExtractionConfidence {
  nameConfidence: number;        // 0-100: Name extraction clarity
  positionConfidence: number;    // 0-100: Position classification
  hoursConfidence: number;       // 0-100: Hours data reliability
  matchConfidence: number;       // 0-100: Deduplication match score
}

function calculatePersonnelConfidence(
  person: ExtractedPersonnel,
  transcript: string,
  matchResult: FuzzyMatchResult
): PersonnelExtractionConfidence {

  // Name Confidence
  const nameConfidence = calculateNameConfidence(
    person.fullName,
    person.goByName,
    person.extractedFromText
  );

  // Position Confidence
  const positionConfidence = calculatePositionConfidence(
    person.position,
    person.extractedFromText
  );

  // Hours Confidence
  const hoursConfidence = calculateHoursConfidence(
    person.hoursWorked,
    person.overtimeHours,
    person.extractedFromText
  );

  // Match Confidence (from fuzzy matching)
  const matchConfidence = matchResult.score;

  return {
    nameConfidence,
    positionConfidence,
    hoursConfidence,
    matchConfidence
  };
}

// Name Confidence Algorithm
function calculateNameConfidence(
  fullName: string,
  goByName: string,
  extractedText: string
): number {
  let score = 100;

  // Penalty for single-name extractions
  if (!fullName.includes(' ')) {
    score -= 20;
  }

  // Penalty for very short names (likely incomplete)
  if (fullName.length < 3) {
    score -= 30;
  }

  // Bonus for explicit mention in transcript
  const mentionCount = extractedText.toLowerCase().split(goByName.toLowerCase()).length - 1;
  if (mentionCount > 1) {
    score += 10; // Multiple mentions increase confidence
  }

  // Penalty for unusual characters
  if (/[0-9!@#$%^&*()]/.test(fullName)) {
    score -= 40;
  }

  return Math.max(0, Math.min(100, score));
}

// Position Confidence Algorithm
function calculatePositionConfidence(
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
    const similarity = calculateStringSimilarity(position, validPos);
    if (similarity > 80) {
      return 75;
    }
  }

  // Check if position mentioned in transcript
  if (extractedText.toLowerCase().includes(position.toLowerCase())) {
    return 60;
  }

  return 40; // Low confidence for unrecognized positions
}

// Hours Confidence Algorithm
function calculateHoursConfidence(
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
  if (totalHours > 0 && totalHours <= 12) {
    score += 0; // Expected range
  } else if (totalHours > 12 && totalHours <= 16) {
    score -= 10; // Possible but unusual
  }

  // Check for explicit hour mention in text
  const hourPattern = /(\d+)\s*(hour|hr|hrs)/i;
  if (hourPattern.test(extractedText)) {
    score += 10;
  }

  return Math.max(0, Math.min(100, score));
}
```

### 2.3 Vendor/Delivery Confidence

```typescript
interface VendorExtractionConfidence {
  companyNameConfidence: number;   // 0-100
  deliveryDetailConfidence: number; // 0-100
  matchConfidence: number;         // 0-100
}

function calculateVendorConfidence(
  vendor: ExtractedVendor,
  matchResult: FuzzyMatchResult
): VendorExtractionConfidence {

  // Company Name Confidence
  const companyNameConfidence = calculateCompanyNameConfidence(
    vendor.companyName,
    vendor.extractedFromText
  );

  // Delivery Detail Confidence
  const deliveryDetailConfidence = calculateDeliveryDetailConfidence(
    vendor.materialsDelivered,
    vendor.deliveryTime,
    vendor.receivedBy
  );

  return {
    companyNameConfidence,
    deliveryDetailConfidence,
    matchConfidence: matchResult.score
  };
}

function calculateCompanyNameConfidence(
  companyName: string,
  extractedText: string
): number {
  let score = 100;

  // Too short (likely incomplete)
  if (companyName.length < 3) {
    score -= 40;
  }

  // Contains common company suffixes (good sign)
  const companySuffixes = ['Inc', 'LLC', 'Corp', 'Ltd', 'Co'];
  const hasSuffix = companySuffixes.some(suffix =>
    companyName.includes(suffix)
  );
  if (hasSuffix) {
    score += 15;
  }

  // Generic names (likely needs review)
  const genericNames = ['vendor', 'supplier', 'company', 'delivery'];
  const isGeneric = genericNames.some(term =>
    companyName.toLowerCase().includes(term)
  );
  if (isGeneric) {
    score -= 30;
  }

  return Math.max(0, Math.min(100, score));
}

function calculateDeliveryDetailConfidence(
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
```

### 2.4 Constraint/Issue Confidence

```typescript
interface ConstraintExtractionConfidence {
  categorySeverityConfidence: number; // 0-100
  descriptionQualityConfidence: number; // 0-100
}

function calculateConstraintConfidence(
  constraint: ExtractedConstraint
): ConstraintExtractionConfidence {

  // Category & Severity Confidence
  const categorySeverityConfidence = calculateCategorySeverityConfidence(
    constraint.category,
    constraint.severity,
    constraint.description
  );

  // Description Quality
  const descriptionQualityConfidence = calculateDescriptionQuality(
    constraint.description,
    constraint.extractedFromText
  );

  return {
    categorySeverityConfidence,
    descriptionQualityConfidence
  };
}

function calculateCategorySeverityConfidence(
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

  // Severity-category alignment check
  const safetyKeywords = ['injury', 'accident', 'unsafe', 'hazard', 'danger'];
  const isSafetyRelated = safetyKeywords.some(kw =>
    description.toLowerCase().includes(kw)
  );

  if (isSafetyRelated && category === 'safety') {
    score += 10; // Consistent categorization
  } else if (isSafetyRelated && category !== 'safety') {
    score -= 20; // Inconsistent categorization
  }

  return Math.max(0, Math.min(100, score));
}

function calculateDescriptionQuality(
  description: string,
  extractedText: string
): number {
  let score = 100;

  // Too short (vague)
  if (description.length < 10) {
    score -= 40;
  }

  // Good length (detailed)
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
```

### 2.5 Historical Pattern Confidence

```typescript
interface HistoricalConfidence {
  personnelConsistency: number;    // How often this person appears
  vendorConsistency: number;       // Vendor reliability history
  workPatternConsistency: number;  // Typical work patterns
}

async function calculateHistoricalConfidence(
  personId: string,
  projectId: string
): Promise<number> {
  // Fetch historical data
  const personHistory = await getPersonnelHistory(personId, projectId);

  if (personHistory.appearances === 0) {
    return 50; // New person, neutral confidence
  }

  // Frequency score
  const frequencyScore = Math.min(100, (personHistory.appearances / 10) * 100);

  // Consistency score (position stability)
  const positionChanges = personHistory.positionChanges || 0;
  const consistencyScore = Math.max(0, 100 - (positionChanges * 10));

  // Recency score (active vs inactive)
  const daysSinceLastSeen = calculateDaysSince(personHistory.dateLastSeen);
  const recencyScore = daysSinceLastSeen < 30 ? 100 :
                       daysSinceLastSeen < 90 ? 80 :
                       daysSinceLastSeen < 180 ? 60 : 40;

  // Weighted average
  return (frequencyScore * 0.4 + consistencyScore * 0.3 + recencyScore * 0.3);
}
```

---

## III. Enhanced Fuzzy Matching Algorithms

### 3.1 Multi-Algorithm Matching Strategy

```typescript
interface FuzzyMatchResult {
  matched: boolean;
  matchedEntityId: string | null;
  score: number;              // 0-100
  algorithm: string;          // Which algorithm matched
  alternatives: Array<{       // Other possible matches
    entityId: string;
    score: number;
  }>;
}

class EnhancedFuzzyMatcher {

  async match(
    input: string,
    candidates: Array<{ id: string; name: string; }>
  ): Promise<FuzzyMatchResult> {

    // Run all matching algorithms
    const levenshteinScores = this.levenshteinMatch(input, candidates);
    const phoneticScores = this.phoneticMatch(input, candidates);
    const nicknameScores = await this.nicknameMatch(input, candidates);
    const tokenScores = this.tokenSetMatch(input, candidates);

    // Combine scores with weights
    const combinedScores = candidates.map((candidate, idx) => ({
      entityId: candidate.id,
      score: (
        levenshteinScores[idx] * 0.30 +
        phoneticScores[idx] * 0.25 +
        nicknameScores[idx] * 0.25 +
        tokenScores[idx] * 0.20
      )
    }));

    // Sort by score
    combinedScores.sort((a, b) => b.score - a.score);

    const best = combinedScores[0];
    const alternatives = combinedScores.slice(1, 4); // Top 3 alternatives

    return {
      matched: best.score >= 85,
      matchedEntityId: best.score >= 85 ? best.entityId : null,
      score: best.score,
      algorithm: 'combined',
      alternatives
    };
  }

  // Algorithm 1: Levenshtein Distance (existing)
  private levenshteinMatch(
    input: string,
    candidates: Array<{ name: string }>
  ): number[] {
    const normalized = this.normalize(input);
    return candidates.map(candidate => {
      const candidateNorm = this.normalize(candidate.name);
      return this.calculateLevenshteinSimilarity(normalized, candidateNorm);
    });
  }

  // Algorithm 2: Phonetic Matching (NEW)
  private phoneticMatch(
    input: string,
    candidates: Array<{ name: string }>
  ): number[] {
    const inputPhonetic = this.metaphone(input);
    return candidates.map(candidate => {
      const candidatePhonetic = this.metaphone(candidate.name);
      return this.calculateLevenshteinSimilarity(inputPhonetic, candidatePhonetic);
    });
  }

  // Algorithm 3: Nickname Database Matching (NEW)
  private async nicknameMatch(
    input: string,
    candidates: Array<{ name: string }>
  ): Promise<number[]> {
    const inputVariations = await this.getNicknameVariations(input);

    return candidates.map(candidate => {
      const candidateVariations = this.extractNames(candidate.name);

      // Check if any variation matches
      let maxScore = 0;
      for (const inputVar of inputVariations) {
        for (const candidateVar of candidateVariations) {
          const score = this.calculateLevenshteinSimilarity(inputVar, candidateVar);
          maxScore = Math.max(maxScore, score);
        }
      }

      return maxScore;
    });
  }

  // Algorithm 4: Token Set Matching (NEW)
  private tokenSetMatch(
    input: string,
    candidates: Array<{ name: string }>
  ): number[] {
    const inputTokens = new Set(input.toLowerCase().split(/\s+/));

    return candidates.map(candidate => {
      const candidateTokens = new Set(candidate.name.toLowerCase().split(/\s+/));

      // Jaccard similarity
      const intersection = new Set(
        [...inputTokens].filter(x => candidateTokens.has(x))
      );
      const union = new Set([...inputTokens, ...candidateTokens]);

      return (intersection.size / union.size) * 100;
    });
  }
}
```

### 3.2 Phonetic Algorithm Implementation

```typescript
class PhoneticMatcher {

  /**
   * Double Metaphone algorithm for phonetic encoding
   * Generates two phonetic codes for better matching
   */
  metaphone(word: string): { primary: string; secondary: string } {
    // Simplified implementation
    // Production should use library like 'natural' or 'double-metaphone'

    const normalized = word.toUpperCase().replace(/[^A-Z]/g, '');

    // Consonant mapping
    const primary = this.encodeMetaphone(normalized);
    const secondary = this.encodeMetaphoneAlternate(normalized);

    return { primary, secondary };
  }

  private encodeMetaphone(word: string): string {
    let encoded = '';

    const rules: Array<[RegExp, string]> = [
      [/^GN/, 'N'],
      [/^KN/, 'N'],
      [/^PN/, 'N'],
      [/^WR/, 'R'],
      [/^X/, 'S'],
      [/SCH/, 'SK'],
      [/CH/, 'K'],
      [/CK/, 'K'],
      [/PH/, 'F'],
      [/QU/, 'K'],
      [/TH/, 'T'],
      [/SH/, 'S'],
      [/[AEIOUWY]/, ''], // Remove vowels except first
    ];

    let temp = word;
    for (const [pattern, replacement] of rules) {
      temp = temp.replace(pattern, replacement);
    }

    // Remove duplicate adjacent letters
    for (let i = 0; i < temp.length; i++) {
      if (i === 0 || temp[i] !== temp[i-1]) {
        encoded += temp[i];
      }
    }

    return encoded.substring(0, 6); // Max length 6
  }

  private encodeMetaphoneAlternate(word: string): string {
    // Alternate encoding for ambiguous sounds
    return this.encodeMetaphone(word)
      .replace(/K/g, 'C')
      .replace(/S/g, 'Z');
  }

  /**
   * Compare two phonetic encodings
   */
  comparePhonetic(
    word1: string,
    word2: string
  ): number {
    const code1 = this.metaphone(word1);
    const code2 = this.metaphone(word2);

    // Check primary match
    if (code1.primary === code2.primary) {
      return 100;
    }

    // Check secondary match
    if (code1.secondary === code2.secondary) {
      return 90;
    }

    // Check cross match
    if (code1.primary === code2.secondary || code1.secondary === code2.primary) {
      return 85;
    }

    // Partial match
    const primarySimilarity = this.calculateLevenshteinSimilarity(
      code1.primary,
      code2.primary
    );

    return primarySimilarity * 0.8; // Reduce score for partial phonetic match
  }
}
```

### 3.3 Nickname Database

```typescript
interface NicknameMapping {
  formal: string;
  nicknames: string[];
  variations: string[];
}

class NicknameDatabase {

  private static commonNicknames: NicknameMapping[] = [
    {
      formal: 'Aaron',
      nicknames: ['A-Rod', 'Ron', 'A'],
      variations: ['Aron', 'Arron']
    },
    {
      formal: 'Michael',
      nicknames: ['Mike', 'Mikey', 'Mick'],
      variations: ['Micheal', 'Mikael']
    },
    {
      formal: 'William',
      nicknames: ['Bill', 'Billy', 'Will', 'Willy', 'Liam'],
      variations: ['Willam']
    },
    {
      formal: 'Robert',
      nicknames: ['Rob', 'Bob', 'Bobby', 'Robby'],
      variations: ['Robbie']
    },
    {
      formal: 'Richard',
      nicknames: ['Rich', 'Rick', 'Dick', 'Ricky'],
      variations: ['Richie']
    },
    {
      formal: 'Christopher',
      nicknames: ['Chris', 'Topher', 'Kit'],
      variations: ['Kristopher']
    },
    {
      formal: 'Andrew',
      nicknames: ['Andy', 'Drew'],
      variations: ['Andew']
    },
    {
      formal: 'Matthew',
      nicknames: ['Matt', 'Matty'],
      variations: ['Mathew']
    },
    {
      formal: 'Daniel',
      nicknames: ['Dan', 'Danny'],
      variations: ['Danial']
    },
    {
      formal: 'Joseph',
      nicknames: ['Joe', 'Joey'],
      variations: ['Josef']
    },
    // Add more as needed...
  ];

  /**
   * Get all possible name variations for matching
   */
  async getVariations(name: string): Promise<string[]> {
    const variations = new Set<string>([name]);

    // Check formal name matches
    for (const mapping of NicknameDatabase.commonNicknames) {
      if (name.toLowerCase() === mapping.formal.toLowerCase()) {
        mapping.nicknames.forEach(nn => variations.add(nn));
        mapping.variations.forEach(v => variations.add(v));
      }

      // Check nickname matches
      if (mapping.nicknames.some(nn =>
        nn.toLowerCase() === name.toLowerCase()
      )) {
        variations.add(mapping.formal);
        mapping.nicknames.forEach(nn => variations.add(nn));
      }
    }

    // Query custom nickname database (DynamoDB)
    const customVariations = await this.queryCustomNicknames(name);
    customVariations.forEach(v => variations.add(v));

    return Array.from(variations);
  }

  /**
   * Query DynamoDB for project-specific nickname mappings
   */
  private async queryCustomNicknames(name: string): Promise<string[]> {
    // TODO: Query sitelogix-personnel table for nicknames
    // This allows learning from historical data
    return [];
  }

  /**
   * Admin function to add custom nickname mapping
   */
  async addCustomMapping(
    formal: string,
    nickname: string,
    projectId?: string
  ): Promise<void> {
    // Store in DynamoDB for future matching
    // Allow project-specific or global mappings
  }
}
```

---

## IV. Model Versioning Strategy

### 4.1 Model Version Tagging

```typescript
interface AIModelVersion {
  modelId: string;              // e.g., "claude-3-5-sonnet-20241022"
  version: string;              // e.g., "v2.1.0"
  promptVersion: string;        // e.g., "extraction-v2.1"
  capabilities: string[];       // e.g., ["personnel", "vendors", "constraints"]
  accuracy: {
    personnel: number;          // Historical accuracy %
    vendors: number;
    constraints: number;
  };
  status: 'active' | 'deprecated' | 'experimental';
  deployedAt: string;
  deprecatedAt?: string;
}

class AIModelRegistry {

  private static models: Map<string, AIModelVersion> = new Map([
    ['v1.0.0', {
      modelId: 'claude-3-5-sonnet-20241022',
      version: 'v1.0.0',
      promptVersion: 'extraction-v1.0',
      capabilities: ['personnel', 'vendors', 'constraints', 'work_logs'],
      accuracy: {
        personnel: 88,
        vendors: 82,
        constraints: 85
      },
      status: 'deprecated',
      deployedAt: '2025-09-01T00:00:00Z',
      deprecatedAt: '2025-11-01T00:00:00Z'
    }],
    ['v2.0.0', {
      modelId: 'claude-3-5-sonnet-20241022',
      version: 'v2.0.0',
      promptVersion: 'extraction-v2.0',
      capabilities: ['personnel', 'vendors', 'constraints', 'work_logs', 'confidence'],
      accuracy: {
        personnel: 92,
        vendors: 87,
        constraints: 89
      },
      status: 'active',
      deployedAt: '2025-11-04T00:00:00Z'
    }]
  ]);

  static getActiveVersion(): AIModelVersion {
    const active = Array.from(this.models.values())
      .find(m => m.status === 'active');

    if (!active) {
      throw new Error('No active AI model version');
    }

    return active;
  }

  static getVersion(version: string): AIModelVersion | null {
    return this.models.get(version) || null;
  }

  static registerNewVersion(model: AIModelVersion): void {
    // Mark previous active as deprecated
    const previousActive = Array.from(this.models.values())
      .find(m => m.status === 'active');

    if (previousActive) {
      previousActive.status = 'deprecated';
      previousActive.deprecatedAt = new Date().toISOString();
    }

    this.models.set(model.version, model);
  }
}
```

### 4.2 Versioned Prompt Management

```typescript
interface PromptTemplate {
  version: string;
  template: string;
  variables: string[];
  capabilities: string[];
  exampleOutputs: any[];
}

class PromptRegistry {

  private static prompts: Map<string, PromptTemplate> = new Map();

  static getPrompt(version: string): PromptTemplate {
    const prompt = this.prompts.get(version);
    if (!prompt) {
      throw new Error(`Prompt version ${version} not found`);
    }
    return prompt;
  }

  static registerPrompt(prompt: PromptTemplate): void {
    // Store in DynamoDB for versioning
    this.prompts.set(prompt.version, prompt);
  }
}

// Example versioned prompts
const extractionPromptV2 = `
You are an AI assistant specialized in extracting structured construction data from daily report conversations.

CONTEXT:
- Project: {projectName}
- Location: {projectLocation}
- Manager: {managerName}
- Date: {reportDate}

TRANSCRIPT:
{rawTranscriptText}

TASK:
Extract ALL of the following information in JSON format WITH CONFIDENCE SCORES (0-100):

[... rest of extraction instructions ...]

IMPORTANT - CONFIDENCE SCORING:
For each extracted entity, provide a confidence score (0-100):
- 90-100: Explicitly stated, unambiguous
- 70-89: Clearly implied, high certainty
- 50-69: Inferred from context, moderate certainty
- 30-49: Uncertain, may need verification
- 0-29: Guess, requires manual review

Return JSON with structure:
{
  "personnel": [
    {
      "fullName": "...",
      "confidence": 95,
      ...
    }
  ],
  ...
}
`;
```

### 4.3 Bulk Reprocessing Architecture

```typescript
interface ReprocessingJob {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  modelVersion: string;
  filter: {
    projectIds?: string[];
    dateRange?: { start: string; end: string };
    reportIds?: string[];
  };
  progress: {
    total: number;
    processed: number;
    succeeded: number;
    failed: number;
  };
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

class BulkReprocessingService {

  /**
   * Create reprocessing job
   */
  async createReprocessingJob(
    modelVersion: string,
    filter: ReprocessingJob['filter']
  ): Promise<string> {

    const jobId = `reprocess_${uuidv4()}`;

    // Query reports matching filter
    const reports = await this.queryReportsForReprocessing(filter);

    const job: ReprocessingJob = {
      jobId,
      status: 'queued',
      modelVersion,
      filter,
      progress: {
        total: reports.length,
        processed: 0,
        succeeded: 0,
        failed: 0
      },
      createdAt: new Date().toISOString()
    };

    // Store job in DynamoDB
    await this.storeReprocessingJob(job);

    // Queue reports for reprocessing (SQS)
    await this.queueReportsForReprocessing(jobId, reports);

    return jobId;
  }

  /**
   * Reprocess single report with new model
   */
  async reprocessReport(
    reportId: string,
    modelVersion: string
  ): Promise<void> {

    console.log(`🔄 Reprocessing report ${reportId} with ${modelVersion}`);

    // 1. Fetch original transcript
    const transcript = await this.fetchTranscript(reportId);

    // 2. Get model and prompt for version
    const model = AIModelRegistry.getVersion(modelVersion);
    if (!model) {
      throw new Error(`Model version ${modelVersion} not found`);
    }

    // 3. Re-run AI extraction
    const extractedData = await this.runAIExtraction(
      transcript,
      model
    );

    // 4. Store new analysis with version tag
    await this.storeReanalysis(reportId, extractedData, modelVersion);

    // 5. Compare with previous analysis (optional)
    await this.compareAnalysisVersions(reportId, modelVersion);

    console.log(`✅ Reprocessing complete for ${reportId}`);
  }

  /**
   * Process reprocessing queue (Lambda handler)
   */
  async processReprocessingQueue(event: any): Promise<void> {
    for (const record of event.Records) {
      const message = JSON.parse(record.body);
      const { jobId, reportId, modelVersion } = message;

      try {
        await this.reprocessReport(reportId, modelVersion);
        await this.updateJobProgress(jobId, 'succeeded');
      } catch (error) {
        console.error(`Failed to reprocess ${reportId}:`, error);
        await this.updateJobProgress(jobId, 'failed');
      }
    }
  }
}
```

---

## V. Enhanced AI Analysis Cache Table

### 5.1 Schema Design

```typescript
// DynamoDB Table: sitelogix-ai-analysis-cache
interface AIAnalysisCacheRecord {
  // Keys
  PK: string;                      // REPORT#{reportId}
  SK: string;                      // AI_ANALYSIS#{analysisType}#{version}

  // Attributes
  reportId: string;
  analysisType: string;            // "full_extraction", "entity_resolution", etc.
  modelUsed: string;               // "claude-3-5-sonnet-20241022"
  modelVersion: string;            // "v2.0.0"
  promptVersion: string;           // "extraction-v2.0"

  // AI Response Data
  rawResponse: string;             // Full AI response (JSON string)
  structuredData: any;             // Parsed structured data

  // Confidence Scores
  confidenceScores: {
    personnel: Array<{
      entityId: string;
      overallConfidence: number;
      extractionConfidence: number;
      matchConfidence: number;
    }>;
    vendors: Array<{
      entityId: string;
      overallConfidence: number;
      extractionConfidence: number;
      matchConfidence: number;
    }>;
    constraints: Array<{
      entityId: string;
      overallConfidence: number;
      categorySeverityConfidence: number;
    }>;
  };

  // Performance Metrics
  processingTimeMs: number;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  costUSD: number;

  // Quality Metrics
  extractionQuality: {
    personnelCount: number;
    vendorsCount: number;
    constraintsCount: number;
    workLogsCount: number;
    averageConfidence: number;
    lowConfidenceCount: number;
  };

  // Flags
  needsReanalysis: boolean;        // Flag for bulk reprocessing
  hasBeenReviewed: boolean;        // Admin reviewed
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;

  // Metadata
  createdAt: string;
  updatedAt: string;

  // GSI attributes
  analysisType_GSI: string;        // For GSI1
  modelUsed_GSI: string;           // For GSI2
  createdAt_GSI: string;           // For sorting
}

// Enhanced cache operations
class AIAnalysisCacheService {

  /**
   * Save analysis with full metrics
   */
  async saveAnalysis(
    reportId: string,
    analysisType: string,
    modelVersion: AIModelVersion,
    rawResponse: string,
    structuredData: any,
    confidenceScores: any,
    metrics: {
      processingTimeMs: number;
      tokensUsed: any;
      costUSD: number;
    }
  ): Promise<void> {

    const record: AIAnalysisCacheRecord = {
      PK: `REPORT#${reportId}`,
      SK: `AI_ANALYSIS#${analysisType}#${modelVersion.version}`,
      reportId,
      analysisType,
      modelUsed: modelVersion.modelId,
      modelVersion: modelVersion.version,
      promptVersion: modelVersion.promptVersion,
      rawResponse,
      structuredData,
      confidenceScores,
      processingTimeMs: metrics.processingTimeMs,
      tokensUsed: metrics.tokensUsed,
      costUSD: metrics.costUSD,
      extractionQuality: this.calculateQualityMetrics(structuredData, confidenceScores),
      needsReanalysis: false,
      hasBeenReviewed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      analysisType_GSI: analysisType,
      modelUsed_GSI: modelVersion.modelId,
      createdAt_GSI: new Date().toISOString()
    };

    await docClient.send(
      new PutCommand({
        TableName: AI_CACHE_TABLE,
        Item: record
      })
    );
  }

  /**
   * Get latest analysis for report
   */
  async getLatestAnalysis(
    reportId: string,
    analysisType: string
  ): Promise<AIAnalysisCacheRecord | null> {

    const result = await docClient.send(
      new QueryCommand({
        TableName: AI_CACHE_TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `REPORT#${reportId}`,
          ':sk': `AI_ANALYSIS#${analysisType}`
        },
        ScanIndexForward: false, // Get latest
        Limit: 1
      })
    );

    return result.Items?.[0] as AIAnalysisCacheRecord || null;
  }

  /**
   * Compare analysis versions
   */
  async compareVersions(
    reportId: string,
    analysisType: string,
    version1: string,
    version2: string
  ): Promise<any> {

    const analysis1 = await this.getAnalysis(reportId, analysisType, version1);
    const analysis2 = await this.getAnalysis(reportId, analysisType, version2);

    if (!analysis1 || !analysis2) {
      throw new Error('Analysis versions not found');
    }

    return {
      version1: version1,
      version2: version2,
      differences: {
        personnelCount: {
          v1: analysis1.extractionQuality.personnelCount,
          v2: analysis2.extractionQuality.personnelCount,
          delta: analysis2.extractionQuality.personnelCount - analysis1.extractionQuality.personnelCount
        },
        averageConfidence: {
          v1: analysis1.extractionQuality.averageConfidence,
          v2: analysis2.extractionQuality.averageConfidence,
          delta: analysis2.extractionQuality.averageConfidence - analysis1.extractionQuality.averageConfidence
        },
        processingTime: {
          v1: analysis1.processingTimeMs,
          v2: analysis2.processingTimeMs,
          delta: analysis2.processingTimeMs - analysis1.processingTimeMs
        },
        cost: {
          v1: analysis1.costUSD,
          v2: analysis2.costUSD,
          delta: analysis2.costUSD - analysis1.costUSD
        }
      }
    };
  }
}
```

---

## VI. Admin Approval Workflow

### 6.1 State Machine Design

```typescript
type WorkflowState =
  | 'pending_extraction'
  | 'extracted'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'needs_correction';

interface WorkflowTransition {
  from: WorkflowState;
  to: WorkflowState;
  trigger: string;
  conditions?: (context: any) => boolean;
  actions: Array<(context: any) => Promise<void>>;
}

class AdminWorkflowStateMachine {

  private static transitions: WorkflowTransition[] = [
    {
      from: 'pending_extraction',
      to: 'extracted',
      trigger: 'ai_extraction_complete',
      actions: [
        async (ctx) => await this.calculateConfidenceScores(ctx),
        async (ctx) => await this.routeForReview(ctx)
      ]
    },
    {
      from: 'extracted',
      to: 'pending_review',
      trigger: 'low_confidence_detected',
      conditions: (ctx) => ctx.overallConfidence < 85,
      actions: [
        async (ctx) => await this.createReviewTask(ctx),
        async (ctx) => await this.notifyAdmin(ctx)
      ]
    },
    {
      from: 'extracted',
      to: 'approved',
      trigger: 'high_confidence_auto_approve',
      conditions: (ctx) => ctx.overallConfidence >= 85,
      actions: [
        async (ctx) => await this.finalizeReport(ctx),
        async (ctx) => await this.updateMetrics(ctx)
      ]
    },
    {
      from: 'pending_review',
      to: 'approved',
      trigger: 'admin_approve',
      actions: [
        async (ctx) => await this.finalizeReport(ctx),
        async (ctx) => await this.logApproval(ctx)
      ]
    },
    {
      from: 'pending_review',
      to: 'needs_correction',
      trigger: 'admin_request_correction',
      actions: [
        async (ctx) => await this.flagForCorrection(ctx),
        async (ctx) => await this.notifyManager(ctx)
      ]
    },
    {
      from: 'pending_review',
      to: 'rejected',
      trigger: 'admin_reject',
      actions: [
        async (ctx) => await this.markRejected(ctx),
        async (ctx) => await this.notifyManager(ctx)
      ]
    }
  ];

  async transition(
    reportId: string,
    trigger: string,
    context: any
  ): Promise<void> {

    // Get current state
    const currentState = await this.getCurrentState(reportId);

    // Find valid transition
    const validTransition = AdminWorkflowStateMachine.transitions.find(t =>
      t.from === currentState &&
      t.trigger === trigger &&
      (!t.conditions || t.conditions(context))
    );

    if (!validTransition) {
      throw new Error(`Invalid transition: ${currentState} -> ${trigger}`);
    }

    console.log(`🔄 Workflow: ${currentState} -> ${validTransition.to}`);

    // Execute actions
    for (const action of validTransition.actions) {
      await action(context);
    }

    // Update state
    await this.updateState(reportId, validTransition.to);
  }
}
```

### 6.2 Review Queue Management

```typescript
interface ReviewTask {
  taskId: string;
  reportId: string;
  taskType: 'personnel_match' | 'vendor_match' | 'constraint_severity' | 'general';
  priority: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  details: any;
  createdAt: string;
  assignedTo?: string;
  reviewedAt?: string;
  resolution?: string;
}

class ReviewQueueService {

  /**
   * Create review task
   */
  async createTask(
    reportId: string,
    taskType: ReviewTask['taskType'],
    reason: string,
    details: any
  ): Promise<string> {

    const taskId = `task_${uuidv4()}`;

    // Determine priority
    const priority = this.calculatePriority(taskType, details);

    const task: ReviewTask = {
      taskId,
      reportId,
      taskType,
      priority,
      reason,
      details,
      createdAt: new Date().toISOString()
    };

    // Store in DynamoDB
    await docClient.send(
      new PutCommand({
        TableName: 'sitelogix-review-queue',
        Item: {
          PK: `TASK#${taskId}`,
          SK: 'METADATA',
          ...task,
          priority_GSI: priority,
          created_at_GSI: task.createdAt
        }
      })
    );

    // Send SQS notification for high/critical priority
    if (priority === 'high' || priority === 'critical') {
      await this.notifyAdminImmediate(task);
    }

    return taskId;
  }

  /**
   * Get pending tasks
   */
  async getPendingTasks(
    priority?: ReviewTask['priority']
  ): Promise<ReviewTask[]> {

    if (priority) {
      const result = await docClient.send(
        new QueryCommand({
          TableName: 'sitelogix-review-queue',
          IndexName: 'GSI1-PriorityIndex',
          KeyConditionExpression: 'priority_GSI = :priority',
          FilterExpression: 'attribute_not_exists(reviewedAt)',
          ExpressionAttributeValues: {
            ':priority': priority
          }
        })
      );

      return result.Items as ReviewTask[];
    }

    // Get all pending tasks
    // Implementation...
    return [];
  }

  /**
   * Resolve task
   */
  async resolveTask(
    taskId: string,
    resolution: string,
    reviewedBy: string
  ): Promise<void> {

    await docClient.send(
      new UpdateCommand({
        TableName: 'sitelogix-review-queue',
        Key: {
          PK: `TASK#${taskId}`,
          SK: 'METADATA'
        },
        UpdateExpression: `
          SET reviewedAt = :reviewedAt,
              resolution = :resolution,
              assignedTo = :assignedTo
        `,
        ExpressionAttributeValues: {
          ':reviewedAt': new Date().toISOString(),
          ':resolution': resolution,
          ':assignedTo': reviewedBy
        }
      })
    );
  }

  private calculatePriority(
    taskType: ReviewTask['taskType'],
    details: any
  ): ReviewTask['priority'] {

    // Critical: Safety issues
    if (details.category === 'safety' && details.severity === 'critical') {
      return 'critical';
    }

    // High: Very low confidence matches
    if (details.confidence && details.confidence < 50) {
      return 'high';
    }

    // Medium: Moderate confidence
    if (details.confidence && details.confidence < 70) {
      return 'medium';
    }

    return 'low';
  }
}
```

---

## VII. Predictive Analytics (Phase 3)

### 7.1 ML Model Architecture

```typescript
interface PredictiveModel {
  modelId: string;
  modelType: 'delay_prediction' | 'cost_overrun' | 'safety_risk' | 'resource_optimization';
  algorithm: 'random_forest' | 'gradient_boosting' | 'neural_network' | 'time_series';
  features: string[];
  trainingDataset: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  trainedAt: string;
  status: 'active' | 'training' | 'deprecated';
}

class PredictiveAnalyticsEngine {

  /**
   * Delay Prediction Model
   * Predicts likelihood of project delays based on constraint patterns
   */
  async predictDelayRisk(projectId: string): Promise<{
    riskScore: number;          // 0-100
    delayLikelihood: 'low' | 'medium' | 'high';
    estimatedDaysDelay: number;
    contributingFactors: Array<{
      factor: string;
      impact: number;           // 0-100
    }>;
  }> {

    // Fetch historical data
    const constraints = await this.getProjectConstraints(projectId);
    const workLogs = await this.getProjectWorkLogs(projectId);
    const personnel = await this.getProjectPersonnel(projectId);

    // Feature engineering
    const features = {
      openConstraintsCount: constraints.filter(c => c.status === 'open').length,
      criticalConstraintsCount: constraints.filter(c => c.severity === 'critical').length,
      averageResolutionTime: this.calculateAverageResolutionTime(constraints),
      personnelTurnoverRate: this.calculateTurnoverRate(personnel),
      overtimePercentage: this.calculateOvertimePercentage(workLogs),
      materialDelayFrequency: this.calculateMaterialDelays(constraints),
      weatherImpactDays: this.calculateWeatherImpact(constraints),
      coordinationIssuesCount: constraints.filter(c => c.category === 'coordination').length
    };

    // Invoke SageMaker endpoint (or local model)
    const prediction = await this.invokePredictionModel('delay_prediction_v1', features);

    return {
      riskScore: prediction.riskScore,
      delayLikelihood: prediction.riskScore > 70 ? 'high' :
                       prediction.riskScore > 40 ? 'medium' : 'low',
      estimatedDaysDelay: prediction.estimatedDaysDelay,
      contributingFactors: prediction.featureImportance
    };
  }

  /**
   * Cost Overrun Prediction
   */
  async predictCostOverrun(projectId: string): Promise<{
    overrunRiskScore: number;
    estimatedOverrunPercentage: number;
    driverCategories: Array<{
      category: string;
      costImpact: number;
    }>;
  }> {

    // Feature engineering for cost prediction
    const features = {
      actualVsBudgetedHours: await this.getHoursVariance(projectId),
      overtimeTrend: await this.getOvertimeTrend(projectId),
      materialCostVariance: await this.getMaterialCostVariance(projectId),
      equipmentUtilization: await this.getEquipmentUtilization(projectId),
      reworkFrequency: await this.getReworkFrequency(projectId)
    };

    const prediction = await this.invokePredictionModel('cost_overrun_v1', features);

    return {
      overrunRiskScore: prediction.riskScore,
      estimatedOverrunPercentage: prediction.overrunPercentage,
      driverCategories: prediction.costDrivers
    };
  }

  /**
   * Safety Risk Scoring
   */
  async calculateSafetyRiskScore(projectId: string): Promise<{
    riskScore: number;          // 0-100
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    riskFactors: Array<{
      factor: string;
      severity: string;
      frequency: number;
    }>;
    recommendations: string[];
  }> {

    const constraints = await this.getProjectConstraints(projectId);
    const safetyIssues = constraints.filter(c => c.category === 'safety');

    // Safety risk calculation
    const riskScore = this.calculateSafetyScore(safetyIssues);

    return {
      riskScore,
      riskLevel: riskScore > 80 ? 'critical' :
                 riskScore > 60 ? 'high' :
                 riskScore > 40 ? 'medium' : 'low',
      riskFactors: this.identifyRiskFactors(safetyIssues),
      recommendations: this.generateSafetyRecommendations(safetyIssues)
    };
  }

  /**
   * Invoke SageMaker model
   */
  private async invokePredictionModel(
    modelId: string,
    features: any
  ): Promise<any> {

    // TODO: Integrate with AWS SageMaker
    // For now, return placeholder

    return {
      riskScore: 65,
      estimatedDaysDelay: 5,
      featureImportance: [
        { factor: 'Material Delays', impact: 35 },
        { factor: 'Weather', impact: 25 },
        { factor: 'Coordination Issues', impact: 20 }
      ]
    };
  }
}
```

### 7.2 Training Data Pipeline

```typescript
class MLTrainingPipeline {

  /**
   * Extract training data from historical reports
   */
  async extractTrainingData(
    startDate: string,
    endDate: string
  ): Promise<any[]> {

    // Query all completed reports in date range
    const reports = await this.queryCompletedReports(startDate, endDate);

    const trainingData = [];

    for (const report of reports) {
      // Extract features
      const features = await this.extractFeatures(report);

      // Extract labels (actual outcomes)
      const labels = await this.extractLabels(report);

      trainingData.push({
        reportId: report.reportId,
        projectId: report.projectId,
        features,
        labels
      });
    }

    return trainingData;
  }

  /**
   * Prepare dataset for SageMaker training
   */
  async prepareDatasetForTraining(
    trainingData: any[],
    modelType: string
  ): Promise<string> {

    // Convert to CSV format
    const csv = this.convertToCSV(trainingData);

    // Upload to S3
    const s3Key = `SITELOGIX/ml-training-data/${modelType}/${Date.now()}.csv`;
    await this.uploadToS3(csv, s3Key);

    return s3Key;
  }

  /**
   * Trigger SageMaker training job
   */
  async trainModel(
    modelType: string,
    trainingDataS3Path: string,
    hyperparameters: any
  ): Promise<string> {

    // TODO: Integrate with SageMaker API
    // Launch training job

    const jobName = `sitelogix-${modelType}-${Date.now()}`;

    console.log(`🚀 Starting training job: ${jobName}`);

    return jobName;
  }
}
```

---

## VIII. Testing Strategy

### 8.1 AI Accuracy Testing

```typescript
class AIAccuracyTester {

  /**
   * Test AI extraction accuracy against ground truth
   */
  async testExtractionAccuracy(
    testDataset: Array<{
      reportId: string;
      transcript: string;
      groundTruth: ExtractedReportData;
    }>
  ): Promise<{
    overallAccuracy: number;
    personnelAccuracy: number;
    vendorAccuracy: number;
    constraintAccuracy: number;
    detailedMetrics: any;
  }> {

    const results = {
      personnel: { correct: 0, total: 0 },
      vendors: { correct: 0, total: 0 },
      constraints: { correct: 0, total: 0 }
    };

    for (const testCase of testDataset) {
      // Run AI extraction
      const extracted = await this.runExtraction(testCase.transcript);

      // Compare with ground truth
      const personnelMatch = this.comparePersonnel(
        extracted.personnel,
        testCase.groundTruth.personnel
      );
      results.personnel.correct += personnelMatch.correct;
      results.personnel.total += personnelMatch.total;

      const vendorMatch = this.compareVendors(
        extracted.vendors,
        testCase.groundTruth.vendors
      );
      results.vendors.correct += vendorMatch.correct;
      results.vendors.total += vendorMatch.total;

      const constraintMatch = this.compareConstraints(
        extracted.constraints,
        testCase.groundTruth.constraints
      );
      results.constraints.correct += constraintMatch.correct;
      results.constraints.total += constraintMatch.total;
    }

    return {
      overallAccuracy: this.calculateOverallAccuracy(results),
      personnelAccuracy: (results.personnel.correct / results.personnel.total) * 100,
      vendorAccuracy: (results.vendors.correct / results.vendors.total) * 100,
      constraintAccuracy: (results.constraints.correct / results.constraints.total) * 100,
      detailedMetrics: results
    };
  }

  /**
   * Test fuzzy matching precision
   */
  async testFuzzyMatchingPrecision(
    testCases: Array<{
      input: string;
      expectedMatch: string;
      shouldMatch: boolean;
    }>
  ): Promise<{
    precision: number;
    recall: number;
    f1Score: number;
  }> {

    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;

    for (const testCase of testCases) {
      const result = await this.fuzzyMatch(testCase.input, testCase.expectedMatch);

      if (result.matched && testCase.shouldMatch) {
        truePositives++;
      } else if (result.matched && !testCase.shouldMatch) {
        falsePositives++;
      } else if (!result.matched && testCase.shouldMatch) {
        falseNegatives++;
      }
    }

    const precision = truePositives / (truePositives + falsePositives);
    const recall = truePositives / (truePositives + falseNegatives);
    const f1Score = 2 * (precision * recall) / (precision + recall);

    return {
      precision: precision * 100,
      recall: recall * 100,
      f1Score: f1Score * 100
    };
  }
}
```

### 8.2 Confidence Scoring Validation

```typescript
class ConfidenceCalibrationTester {

  /**
   * Validate confidence scores are well-calibrated
   */
  async validateConfidenceCalibration(
    predictions: Array<{
      predicted: any;
      confidence: number;
      actual: any;
    }>
  ): Promise<{
    calibrationError: number;
    calibrationCurve: Array<{ confidence: number; accuracy: number }>;
  }> {

    // Group predictions by confidence buckets
    const buckets = this.groupByConfidenceBucket(predictions, 10);

    const calibrationCurve = [];
    let totalCalibrationError = 0;

    for (const bucket of buckets) {
      const avgConfidence = bucket.avgConfidence;
      const actualAccuracy = bucket.correctCount / bucket.totalCount;

      calibrationCurve.push({
        confidence: avgConfidence,
        accuracy: actualAccuracy * 100
      });

      // Expected Calibration Error (ECE)
      totalCalibrationError += Math.abs(avgConfidence - actualAccuracy);
    }

    return {
      calibrationError: (totalCalibrationError / buckets.length) * 100,
      calibrationCurve
    };
  }
}
```

---

## IX. Implementation Roadmap

### Phase 1: Confidence Scoring (Week 1-2)
- [ ] Implement confidence scoring algorithms for all entity types
- [ ] Update extraction service to return confidence scores
- [ ] Add confidence fields to database schemas
- [ ] Test confidence accuracy with sample data

### Phase 2: Enhanced Fuzzy Matching (Week 3-4)
- [ ] Implement phonetic matching algorithm
- [ ] Build nickname database and matching logic
- [ ] Integrate token-set matching
- [ ] Test fuzzy matching precision (target: 90%+)

### Phase 3: Model Versioning (Week 5)
- [ ] Implement model registry
- [ ] Create prompt versioning system
- [ ] Tag all existing analyses with model version
- [ ] Build version comparison tools

### Phase 4: Admin Workflow (Week 6-7)
- [ ] Design review queue table schema
- [ ] Implement state machine logic
- [ ] Build admin UI for review tasks
- [ ] Integrate with notification system (SNS/SQS)

### Phase 5: Bulk Reprocessing (Week 8)
- [ ] Design reprocessing job schema
- [ ] Implement queue-based reprocessing
- [ ] Build progress tracking
- [ ] Test with sample reports

### Phase 6: Enhanced AI Cache (Week 9)
- [ ] Update AI cache table schema
- [ ] Add performance metrics tracking
- [ ] Implement version comparison
- [ ] Build cache analytics dashboard

### Phase 7: Predictive Analytics Foundation (Week 10-12)
- [ ] Extract training data pipeline
- [ ] Implement feature engineering
- [ ] Build delay prediction model (MVP)
- [ ] Integrate with SageMaker

### Phase 8: Testing & Validation (Week 13-14)
- [ ] Build automated testing suite
- [ ] Validate AI accuracy (target: 92%+)
- [ ] Validate confidence calibration
- [ ] Validate fuzzy matching precision (target: 90%+)
- [ ] Load testing for production

---

## X. Success Metrics

### KPIs
- **AI Extraction Accuracy:** 92%+ (vs. 88% current)
- **Entity Resolution Precision:** 90%+ for personnel, 85%+ for vendors
- **Confidence Calibration Error:** <10%
- **Auto-Approval Rate:** 75%+ of reports (high confidence)
- **Manual Review Rate:** <25% of reports
- **Average Processing Time:** <2 minutes per report
- **Cost per Report:** <$0.15 (including AI + compute)

### Phase 3 Predictive Analytics Targets
- **Delay Prediction Accuracy:** 70%+ (7 days in advance)
- **Cost Overrun Prediction:** ±10% accuracy
- **Safety Risk Detection:** 90%+ recall for critical issues

---

## XI. Appendices

### A. Database Schema Updates

```sql
-- Add confidence scoring fields to all extraction tables

-- Personnel History
ALTER TABLE sitelogix-personnel
ADD COLUMN extractionConfidence DECIMAL(5,2);
ADD COLUMN matchConfidence DECIMAL(5,2);
ADD COLUMN overallConfidence DECIMAL(5,2);

-- Vendors
ALTER TABLE sitelogix-vendors
ADD COLUMN extractionConfidence DECIMAL(5,2);
ADD COLUMN matchConfidence DECIMAL(5,2);

-- Constraints
ALTER TABLE sitelogix-constraints
ADD COLUMN categorySeverityConfidence DECIMAL(5,2);
ADD COLUMN descriptionQualityConfidence DECIMAL(5,2);

-- Reports
ALTER TABLE sitelogix-reports
ADD COLUMN aiModelVersion VARCHAR(20);
ADD COLUMN promptVersion VARCHAR(20);
ADD COLUMN overallConfidence DECIMAL(5,2);
ADD COLUMN requiresReview BOOLEAN;
```

### B. Environment Variables

```bash
# AI Model Configuration
AI_MODEL_VERSION=v2.0.0
AI_PROMPT_VERSION=extraction-v2.0
ANTHROPIC_API_KEY=sk-...
CONFIDENCE_THRESHOLD_AUTO_APPROVE=85
CONFIDENCE_THRESHOLD_REVIEW=60

# Fuzzy Matching Configuration
FUZZY_MATCH_THRESHOLD=85
PHONETIC_MATCHING_ENABLED=true
NICKNAME_DATABASE_ENABLED=true

# Admin Workflow Configuration
REVIEW_QUEUE_SQS_URL=https://sqs.us-east-1.amazonaws.com/.../review-queue
CRITICAL_ISSUE_SNS_TOPIC=arn:aws:sns:us-east-1:.../critical-issues

# Reprocessing Configuration
REPROCESSING_QUEUE_SQS_URL=https://sqs.us-east-1.amazonaws.com/.../reprocess-queue
REPROCESSING_BATCH_SIZE=100

# ML Model Configuration (Phase 3)
SAGEMAKER_ENDPOINT_DELAY_PREDICTION=sitelogix-delay-v1
SAGEMAKER_ENDPOINT_COST_PREDICTION=sitelogix-cost-v1
```

---

**Document Status:** Production Ready
**Next Review Date:** December 4, 2025
**Owner:** Data Science Team
**Approvers:** CTO, Lead Backend Architect
