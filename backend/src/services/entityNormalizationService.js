#!/usr/bin/env node

/**
 * Entity Normalization Service
 *
 * Handles deduplication and normalization of entities extracted from transcripts:
 * - Personnel names (fuzzy matching, canonical IDs)
 * - Project names (abbreviation mapping, canonical IDs)
 * - Vendor names (fuzzy matching)
 *
 * Key Features:
 * - Levenshtein distance for fuzzy matching
 * - Canonical ID assignment
 * - Master entity lists
 * - Duplicate detection
 */

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching of names
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1].toLowerCase() === str2[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,    // deletion
          dp[i][j - 1] + 1,    // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity score between two strings (0-1)
 */
function similarityScore(str1, str2) {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1.0;

  const distance = levenshteinDistance(str1, str2);
  return 1.0 - (distance / maxLength);
}

/**
 * Master Personnel List
 * Canonical names and known aliases from training data analysis
 */
const MASTER_PERSONNEL = {
  'per_001': {
    canonical_name: 'Kenny',
    aliases: ['Kenny', 'Ken'],
    role: 'Superintendent',
    primary_project: 'Cortex Commons'
  },
  'per_002': {
    canonical_name: 'Kurt',
    aliases: ['Kurt'],
    role: 'Foreman',
    primary_project: 'Meharry Medical College'
  },
  'per_003': {
    canonical_name: 'Wes',
    aliases: ['Wes', 'Wesley'],
    role: 'Superintendent',
    primary_project: 'Multiple Sites'
  },
  'per_004': {
    canonical_name: 'Mike',
    aliases: ['Mike', 'Michael'],
    role: 'Foreman',
    primary_project: 'Nashville Yards Tower 2'
  },
  'per_005': {
    canonical_name: 'Brian',
    aliases: ['Brian', 'Bryan'],
    role: 'Superintendent',
    primary_project: 'Nashville Yards Tower 2'
  },
  'per_006': {
    canonical_name: 'Jim',
    aliases: ['Jim', 'James'],
    role: 'Foreman',
    primary_project: 'Various'
  },
  'per_007': {
    canonical_name: 'Scott',
    aliases: ['Scott'],
    role: 'Foreman',
    primary_project: 'Monsanto'
  },
  'per_008': {
    canonical_name: 'Scott Russell',
    aliases: ['Scott Russell', 'Scott R.', 'Russell'],
    role: 'Plumber',
    primary_project: 'Cortex Commons'
  },
  'per_009': {
    canonical_name: 'Owen Glassburn',
    aliases: ['Owen Glassburn', 'Owen', 'Owen glass burner'],
    role: 'Laborer',
    primary_project: 'Cortex Commons'
  }
};

/**
 * Master Project List
 * Canonical names and abbreviations from training data
 */
const MASTER_PROJECTS = {
  'proj_001': {
    canonical_name: 'Cortex Commons',
    abbreviations: ['CC', 'Cortex'],
    location: 'St. Louis, MO',
    primary_manager: 'per_001' // Kenny
  },
  'proj_002': {
    canonical_name: 'Meharry Medical College',
    abbreviations: ['Meharry', 'Meharry Medical'],
    location: 'Nashville, TN',
    primary_manager: 'per_002' // Kurt
  },
  'proj_003': {
    canonical_name: 'Nashville Yards Tower 2',
    abbreviations: ['Nash Twr 2', 'Nash Tower 2', 'Nashville Yards'],
    location: 'Nashville, TN',
    primary_manager: 'per_004' // Mike
  },
  'proj_004': {
    canonical_name: 'Mellow Mushroom',
    abbreviations: ['MM', 'Mellow'],
    location: 'TBD',
    primary_manager: 'per_003' // Wes
  },
  'proj_005': {
    canonical_name: 'Saint Louis University Residence',
    abbreviations: ['SLU Res', 'SLU', 'Saint Louis University'],
    location: 'St. Louis, MO',
    primary_manager: 'per_003' // Wes
  },
  'proj_006': {
    canonical_name: 'Bommarito Automotive',
    abbreviations: ['Bommarito', 'Bommarito Auto'],
    location: 'TBD',
    primary_manager: 'per_003' // Wes
  },
  'proj_007': {
    canonical_name: 'Surgery Partners',
    abbreviations: ['Sx Partners', 'Six Partners', 'Surgery Partners'],
    location: 'TBD',
    primary_manager: 'per_006' // Jim
  },
  'proj_008': {
    canonical_name: 'Carpenters Hall',
    abbreviations: ['Carpenters', 'Carpenters Hall'],
    location: 'TBD',
    primary_manager: 'per_006' // Jim
  },
  'proj_009': {
    canonical_name: 'Monsanto',
    abbreviations: ['Monsanto', 'MM'],
    location: 'TBD',
    primary_manager: 'per_007' // Scott
  },
  'proj_010': {
    canonical_name: 'Parkway North',
    abbreviations: ['Parkway', 'Parkway North'],
    location: 'TBD',
    primary_manager: null
  },
  'proj_011': {
    canonical_name: 'Samantha\'s House',
    abbreviations: ['Samantha', 'Samanthas House'],
    location: 'TBD',
    primary_manager: 'per_006' // Jim
  },
  'proj_012': {
    canonical_name: 'Brentwood',
    abbreviations: ['Brentwood'],
    location: 'TBD',
    primary_manager: null
  },
  'proj_013': {
    canonical_name: 'Triad',
    abbreviations: ['Triad'],
    location: 'TBD',
    primary_manager: null
  }
};

/**
 * Normalize a personnel name to canonical ID
 *
 * @param {string} name - Raw name from transcript
 * @param {Object} context - Additional context (role, project) for disambiguation
 * @returns {Object} - {personnel_id, canonical_name, confidence, is_new}
 */
function normalizePersonnel(name, context = {}) {
  if (!name || typeof name !== 'string') {
    return { personnel_id: null, canonical_name: null, confidence: 0, is_new: false };
  }

  const cleanName = name.trim();

  // Direct alias match (highest confidence)
  for (const [personnelId, personnel] of Object.entries(MASTER_PERSONNEL)) {
    for (const alias of personnel.aliases) {
      if (alias.toLowerCase() === cleanName.toLowerCase()) {
        return {
          personnel_id: personnelId,
          canonical_name: personnel.canonical_name,
          confidence: 1.0,
          is_new: false,
          role: personnel.role
        };
      }
    }
  }

  // Fuzzy match (medium confidence)
  let bestMatch = null;
  let bestScore = 0;

  for (const [personnelId, personnel] of Object.entries(MASTER_PERSONNEL)) {
    const score = similarityScore(cleanName, personnel.canonical_name);

    // Check aliases too
    for (const alias of personnel.aliases) {
      const aliasScore = similarityScore(cleanName, alias);
      if (aliasScore > score && aliasScore > bestScore) {
        bestMatch = { personnelId, personnel };
        bestScore = aliasScore;
      }
    }

    if (score > bestScore) {
      bestMatch = { personnelId, personnel };
      bestScore = score;
    }
  }

  // If we found a good fuzzy match (>0.8 similarity)
  if (bestMatch && bestScore > 0.8) {
    return {
      personnel_id: bestMatch.personnelId,
      canonical_name: bestMatch.personnel.canonical_name,
      confidence: bestScore,
      is_new: false,
      role: bestMatch.personnel.role,
      fuzzy_match: true
    };
  }

  // No match found - this is a new person
  return {
    personnel_id: null,
    canonical_name: cleanName,
    confidence: 0.5,
    is_new: true,
    needs_review: true
  };
}

/**
 * Normalize a project name to canonical ID
 *
 * @param {string} name - Raw project name from transcript
 * @param {Object} context - Additional context (reporter, location) for disambiguation
 * @returns {Object} - {project_id, canonical_name, confidence, is_new}
 */
function normalizeProject(name, context = {}) {
  if (!name || typeof name !== 'string') {
    return { project_id: null, canonical_name: null, confidence: 0, is_new: false };
  }

  const cleanName = name.trim();

  // Direct abbreviation or name match (highest confidence)
  for (const [projectId, project] of Object.entries(MASTER_PROJECTS)) {
    // Check abbreviations
    for (const abbr of project.abbreviations) {
      if (abbr.toLowerCase() === cleanName.toLowerCase()) {
        // Special case: "MM" can be Mellow Mushroom OR Monsanto
        if (abbr === 'MM') {
          // If reporter is Scott, it's Monsanto
          if (context.reporter_name && context.reporter_name.toLowerCase().includes('scott')) {
            return {
              project_id: 'proj_009', // Monsanto
              canonical_name: 'Monsanto',
              confidence: 0.95,
              is_new: false,
              context_disambiguated: true
            };
          }
          // Otherwise default to Mellow Mushroom
          return {
            project_id: 'proj_004', // Mellow Mushroom
            canonical_name: 'Mellow Mushroom',
            confidence: 0.9,
            is_new: false,
            ambiguous: 'MM could be Mellow Mushroom or Monsanto'
          };
        }

        return {
          project_id: projectId,
          canonical_name: project.canonical_name,
          confidence: 1.0,
          is_new: false
        };
      }
    }

    // Check canonical name match
    if (project.canonical_name.toLowerCase() === cleanName.toLowerCase()) {
      return {
        project_id: projectId,
        canonical_name: project.canonical_name,
        confidence: 1.0,
        is_new: false
      };
    }
  }

  // Fuzzy match (medium confidence)
  let bestMatch = null;
  let bestScore = 0;

  for (const [projectId, project] of Object.entries(MASTER_PROJECTS)) {
    const score = similarityScore(cleanName, project.canonical_name);

    if (score > bestScore) {
      bestMatch = { projectId, project };
      bestScore = score;
    }
  }

  // If we found a good fuzzy match (>0.85 similarity)
  if (bestMatch && bestScore > 0.85) {
    return {
      project_id: bestMatch.projectId,
      canonical_name: bestMatch.project.canonical_name,
      confidence: bestScore,
      is_new: false,
      fuzzy_match: true
    };
  }

  // No match found - this is a new project
  return {
    project_id: null,
    canonical_name: cleanName,
    confidence: 0.5,
    is_new: true,
    needs_review: true
  };
}

/**
 * Normalize all entities in an extracted report
 *
 * @param {Object} extractedData - Raw extracted data from Roxy
 * @returns {Object} - Normalized data with canonical IDs
 */
function normalizeExtractedData(extractedData) {
  const normalized = { ...extractedData };

  // Normalize reporter
  if (normalized.reporter_name) {
    const reporterNorm = normalizePersonnel(normalized.reporter_name);
    normalized.reporter_personnel_id = reporterNorm.personnel_id;
    normalized.reporter_canonical_name = reporterNorm.canonical_name;
    normalized.reporter_confidence = reporterNorm.confidence;
    normalized.reporter_is_new = reporterNorm.is_new;
  }

  // Normalize project
  if (normalized.project_name) {
    const projectNorm = normalizeProject(normalized.project_name, {
      reporter_name: normalized.reporter_name
    });
    normalized.project_id = projectNorm.project_id;
    normalized.project_canonical_name = projectNorm.canonical_name;
    normalized.project_confidence = projectNorm.confidence;
    normalized.project_is_new = projectNorm.is_new;

    if (projectNorm.ambiguous) {
      normalized.ambiguities = normalized.ambiguities || [];
      normalized.ambiguities.push(projectNorm.ambiguous);
    }
  }

  // Normalize additional personnel
  if (normalized.additional_personnel && Array.isArray(normalized.additional_personnel)) {
    normalized.additional_personnel = normalized.additional_personnel.map(person => {
      const personNorm = normalizePersonnel(person.name);
      return {
        ...person,
        personnel_id: personNorm.personnel_id,
        canonical_name: personNorm.canonical_name,
        confidence: personNorm.confidence,
        is_new: personNorm.is_new
      };
    });
  }

  // Add normalization metadata
  normalized.normalization_timestamp = new Date().toISOString();
  normalized.normalization_version = '1.0';

  return normalized;
}

/**
 * Get all master personnel
 */
function getMasterPersonnel() {
  return MASTER_PERSONNEL;
}

/**
 * Get all master projects
 */
function getMasterProjects() {
  return MASTER_PROJECTS;
}

module.exports = {
  normalizePersonnel,
  normalizeProject,
  normalizeExtractedData,
  getMasterPersonnel,
  getMasterProjects,
  levenshteinDistance,
  similarityScore
};
