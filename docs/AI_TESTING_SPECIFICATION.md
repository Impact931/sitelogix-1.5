# SiteLogix AI/ML Pipeline - Testing Specification

**Version:** 1.0
**Date:** November 4, 2025
**Owner:** QA + Data Science Team

---

## Testing Overview

This document specifies the testing strategy for validating AI accuracy, confidence calibration, fuzzy matching precision, and system performance for the SiteLogix AI/ML pipeline.

---

## I. AI Extraction Accuracy Testing

### 1.1 Test Dataset Creation

**Objective:** Create ground truth dataset for validation

**Requirements:**
- 50 manually labeled transcripts
- Diverse scenarios (simple, complex, ambiguous)
- Multiple projects and managers
- Various personnel counts (2-20 people per report)

**Ground Truth Labels:**
```typescript
interface GroundTruthReport {
  reportId: string;
  transcript: string;
  manuallyExtracted: {
    personnel: Array<{
      fullName: string;
      goByName: string;
      position: string;
      hoursWorked: number;
      overtimeHours: number;
      isCorrect: boolean;  // Marked by human reviewer
    }>;
    vendors: Array<{
      companyName: string;
      materialsDelivered: string;
      isCorrect: boolean;
    }>;
    constraints: Array<{
      category: string;
      severity: string;
      description: string;
      isCorrect: boolean;
    }>;
  };
  difficultyLevel: 'easy' | 'medium' | 'hard';
  notes: string;
}
```

**Test Dataset Distribution:**
- Easy (clear, structured): 20 reports
- Medium (some ambiguity): 20 reports
- Hard (complex, noisy): 10 reports

### 1.2 Extraction Accuracy Metrics

**Metrics to Calculate:**

#### Personnel Extraction
```typescript
interface PersonnelAccuracyMetrics {
  truePositives: number;    // Correctly identified personnel
  falsePositives: number;   // Incorrectly identified personnel
  falseNegatives: number;   // Missed personnel

  precision: number;        // TP / (TP + FP)
  recall: number;           // TP / (TP + FN)
  f1Score: number;          // 2 * (P * R) / (P + R)

  // Field-level accuracy
  nameAccuracy: number;     // % of names correctly extracted
  positionAccuracy: number; // % of positions correctly classified
  hoursAccuracy: number;    // % of hours within ±0.5 hours
}
```

#### Vendor Extraction
```typescript
interface VendorAccuracyMetrics {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;

  precision: number;
  recall: number;
  f1Score: number;

  companyNameAccuracy: number;
  materialDescriptionQuality: number;  // Completeness score
}
```

#### Constraint Extraction
```typescript
interface ConstraintAccuracyMetrics {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;

  precision: number;
  recall: number;
  f1Score: number;

  categoryAccuracy: number;   // % correct categorization
  severityAccuracy: number;   // % correct severity
  criticalRecall: number;     // % of critical issues detected
}
```

**Target Metrics:**
| Entity Type | Precision | Recall | F1 Score |
|-------------|-----------|--------|----------|
| Personnel | ≥90% | ≥88% | ≥89% |
| Vendors | ≥85% | ≥82% | ≥83% |
| Constraints | ≥88% | ≥90% | ≥89% |

**Critical Safety Recall:** ≥95% (must catch all safety issues)

### 1.3 Test Execution

**Automated Test Script:**
```typescript
async function testExtractionAccuracy() {
  const testDataset = await loadGroundTruthDataset();
  const results: AccuracyResults = {
    personnel: { tp: 0, fp: 0, fn: 0 },
    vendors: { tp: 0, fp: 0, fn: 0 },
    constraints: { tp: 0, fp: 0, fn: 0 }
  };

  for (const testCase of testDataset) {
    // Run AI extraction
    const extracted = await runAIExtraction(testCase.transcript);

    // Compare with ground truth
    const personnelMatch = comparePersonnel(
      extracted.personnel,
      testCase.manuallyExtracted.personnel
    );
    results.personnel.tp += personnelMatch.tp;
    results.personnel.fp += personnelMatch.fp;
    results.personnel.fn += personnelMatch.fn;

    // Same for vendors and constraints...
  }

  // Calculate metrics
  return calculateMetrics(results);
}
```

**Run Schedule:**
- Before each model version release
- Weekly during development
- After prompt modifications

---

## II. Confidence Calibration Testing

### 2.1 Calibration Metrics

**Expected Calibration Error (ECE):**
```typescript
function calculateECE(
  predictions: Array<{
    confidence: number;
    isCorrect: boolean;
  }>
): number {
  const buckets = groupByConfidenceBucket(predictions, 10);

  let totalError = 0;
  for (const bucket of buckets) {
    const avgConfidence = bucket.avgConfidence;
    const accuracy = bucket.correctCount / bucket.totalCount;
    totalError += Math.abs(avgConfidence - accuracy);
  }

  return (totalError / buckets.length) * 100;
}
```

**Target ECE:** <10% (well-calibrated)

**Calibration Curve:**
```
Expected: Confidence = Accuracy (diagonal line)
Actual: Plot confidence buckets vs. actual accuracy

Example:
Confidence 90-100%: Should have 95% accuracy
Confidence 80-90%: Should have 85% accuracy
Confidence 70-80%: Should have 75% accuracy
```

### 2.2 Calibration Test Procedure

1. Run extraction on 100 test reports
2. For each entity extracted, record:
   - Confidence score (0-100)
   - Actual correctness (correct/incorrect)
3. Group into 10 confidence buckets
4. Calculate actual accuracy per bucket
5. Compare confidence vs. accuracy
6. Calculate ECE

**Pass Criteria:**
- ECE < 10%
- No bucket with >15% deviation from diagonal
- High confidence (>85%) must have >80% accuracy

---

## III. Fuzzy Matching Precision Testing

### 3.1 Test Dataset for Fuzzy Matching

**Personnel Name Matching:**
```typescript
interface FuzzyMatchTestCase {
  input: string;
  candidates: Array<{
    id: string;
    name: string;
  }>;
  expectedMatchId: string | null;
  shouldMatch: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
  reason: string;  // Why this is challenging
}
```

**Test Cases (200 total):**

**Easy Cases (60):**
- Exact matches: "John Smith" → "John Smith"
- Simple typos: "Jon Smith" → "John Smith"
- Case differences: "john smith" → "John Smith"

**Medium Cases (80):**
- Common nicknames: "Mike" → "Michael Johnson"
- Middle name variations: "John A. Smith" → "John Smith"
- Suffix variations: "Robert Smith Jr" → "Robert Smith"

**Hard Cases (60):**
- Phonetic similarities: "Sean" → "Shaun"
- Initials: "J. Smith" → "John Smith"
- Misspellings: "Aron" → "Aaron"
- Foreign names: "José" → "Jose"

### 3.2 Fuzzy Matching Metrics

```typescript
interface FuzzyMatchingMetrics {
  // Classification Metrics
  truePositives: number;   // Correctly matched
  falsePositives: number;  // Incorrectly matched (wrong entity)
  trueNegatives: number;   // Correctly rejected (no match)
  falseNegatives: number;  // Incorrectly rejected (should match)

  // Derived Metrics
  precision: number;       // TP / (TP + FP)
  recall: number;          // TP / (TP + FN)
  f1Score: number;
  accuracy: number;        // (TP + TN) / Total

  // Threshold Analysis
  precisionAtThreshold85: number;
  recallAtThreshold85: number;
  precisionAtThreshold90: number;
  recallAtThreshold90: number;
}
```

**Target Metrics:**
| Threshold | Precision | Recall | F1 Score |
|-----------|-----------|--------|----------|
| 85% | ≥90% | ≥85% | ≥87% |
| 90% | ≥95% | ≥80% | ≥87% |

### 3.3 Algorithm Comparison Test

**Test Each Algorithm Independently:**
```typescript
async function compareMatchingAlgorithms() {
  const testCases = await loadFuzzyMatchTestCases();

  const algorithms = [
    'levenshtein',
    'phonetic',
    'nickname',
    'tokenSet',
    'combined'
  ];

  for (const algorithm of algorithms) {
    const metrics = await testAlgorithm(algorithm, testCases);
    console.log(`${algorithm}: Precision=${metrics.precision}%, Recall=${metrics.recall}%`);
  }
}
```

**Expected Results:**
- Levenshtein: Good for typos
- Phonetic: Good for misspellings
- Nickname: Good for common variations
- Token Set: Good for word order
- Combined: Best overall performance

---

## IV. Performance Testing

### 4.1 Processing Time Tests

**Metrics:**
- Transcript extraction time
- Entity resolution time
- Confidence scoring time
- Total pipeline time

**Targets:**
| Stage | Target Time |
|-------|-------------|
| AI Extraction | <90 seconds |
| Entity Resolution | <20 seconds |
| Confidence Scoring | <5 seconds |
| Total Pipeline | <120 seconds |

**Test Scenarios:**
- Small report (5 personnel): <60 seconds
- Medium report (10 personnel): <90 seconds
- Large report (20 personnel): <120 seconds

### 4.2 Concurrency Tests

**Load Testing:**
- Simulate 10 concurrent report submissions
- Measure throughput (reports/minute)
- Measure Lambda cold start impact
- Measure DynamoDB throttling

**Target Throughput:** 30 reports/minute

### 4.3 Cost Testing

**Track Costs Per Report:**
```typescript
interface CostBreakdown {
  aiTokensInput: number;
  aiTokensOutput: number;
  aiCostUSD: number;
  lambdaInvocations: number;
  lambdaCostUSD: number;
  dynamoWrites: number;
  dynamoCostUSD: number;
  totalCostUSD: number;
}
```

**Target Cost:** <$0.15 per report

---

## V. Regression Testing

### 5.1 Automated Regression Suite

**Run On:**
- Every code commit (CI/CD)
- Before model version updates
- Weekly scheduled runs

**Tests:**
1. Extraction accuracy (10 baseline reports)
2. Confidence scoring consistency
3. Fuzzy matching precision (50 baseline cases)
4. Performance benchmarks

**Pass Criteria:**
- No regression >5% in any metric
- No increase >10% in processing time
- No increase in cost per report

### 5.2 Model Version Comparison

**Compare New vs. Old Model:**
```typescript
async function compareModelVersions(
  reportIds: string[],
  oldVersion: string,
  newVersion: string
) {
  const comparison = {
    accuracyDelta: 0,
    confidenceDelta: 0,
    timeDelta: 0,
    costDelta: 0
  };

  for (const reportId of reportIds) {
    const oldAnalysis = await getAnalysis(reportId, oldVersion);
    const newAnalysis = await reprocessReport(reportId, newVersion);

    // Compare metrics...
  }

  return comparison;
}
```

---

## VI. Test Execution Schedule

### Development Phase
- Daily: Unit tests
- Weekly: Integration tests
- Bi-weekly: Accuracy validation

### Pre-Production
- Full regression suite
- Load testing
- Cost validation
- Confidence calibration check

### Production
- Monthly: Accuracy spot checks (10 random reports)
- Quarterly: Full accuracy validation (50 reports)
- Continuous: Performance monitoring

---

## VII. Test Automation

### 7.1 CI/CD Integration

**GitHub Actions Workflow:**
```yaml
name: AI Pipeline Tests

on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm test

      - name: Run extraction accuracy tests
        run: npm run test:accuracy

      - name: Run fuzzy matching tests
        run: npm run test:fuzzy

      - name: Run confidence calibration tests
        run: npm run test:confidence

      - name: Generate test report
        run: npm run test:report
```

### 7.2 Test Data Management

**Test Data Storage:**
- Ground truth dataset: S3 bucket `sitelogix-test-data/ground-truth/`
- Fuzzy match cases: S3 bucket `sitelogix-test-data/fuzzy-matching/`
- Performance baselines: DynamoDB table `sitelogix-test-baselines`

---

## VIII. Reporting and Monitoring

### 8.1 Test Reports

**Generate After Each Test Run:**
```typescript
interface TestReport {
  runId: string;
  timestamp: string;
  modelVersion: string;

  extractionAccuracy: {
    personnel: AccuracyMetrics;
    vendors: AccuracyMetrics;
    constraints: AccuracyMetrics;
  };

  confidenceCalibration: {
    ece: number;
    calibrationCurve: Array<{ confidence: number; accuracy: number }>;
  };

  fuzzyMatchingPrecision: {
    precision: number;
    recall: number;
    f1Score: number;
  };

  performance: {
    avgProcessingTime: number;
    avgCost: number;
    throughput: number;
  };

  passFail: {
    allTestsPassed: boolean;
    failedTests: string[];
  };
}
```

### 8.2 CloudWatch Dashboards

**Production Monitoring:**
- AI extraction success rate
- Average confidence scores
- Auto-approval rate
- Manual review queue size
- Processing time trends
- Cost per report trends

**Alerts:**
- Extraction accuracy drops below 85%
- Confidence calibration ECE > 15%
- Processing time exceeds 150 seconds
- Cost per report exceeds $0.20
- Error rate exceeds 5%

---

## IX. Test Maintenance

### 9.1 Ground Truth Dataset Updates

**Quarterly Review:**
- Add 10 new test cases
- Remove outdated cases
- Update difficulty classifications
- Validate existing labels

### 9.2 Baseline Updates

**After Model Version Updates:**
- Re-establish baseline metrics
- Update target thresholds if needed
- Document changes in accuracy

---

## X. Acceptance Criteria

### Phase 1-6 Sign-off Criteria

**AI Accuracy:**
- ✅ Personnel extraction: ≥90% precision, ≥88% recall
- ✅ Vendor extraction: ≥85% precision, ≥82% recall
- ✅ Constraint extraction: ≥88% precision, ≥90% recall
- ✅ Critical safety recall: ≥95%

**Confidence Scoring:**
- ✅ ECE < 10%
- ✅ High confidence (>85%) achieves >80% accuracy
- ✅ Auto-approval rate 70-80%

**Fuzzy Matching:**
- ✅ Personnel matching: ≥90% precision at 85% threshold
- ✅ Vendor matching: ≥85% precision at 85% threshold
- ✅ False positive rate: <10%

**Performance:**
- ✅ Processing time: <120 seconds
- ✅ Throughput: >30 reports/minute
- ✅ Cost: <$0.15 per report

**Regression:**
- ✅ No metric regression >5%
- ✅ All automated tests passing

---

**Document Version:** 1.0
**Last Updated:** November 4, 2025
**Next Review:** December 4, 2025
**Owner:** QA Team + Data Science Team
