#!/usr/bin/env node

/**
 * Generates coverage-summary.json from coverage-final.json.
 * Jest's "json" reporter creates coverage-final.json which contains detailed per-file data.
 * This script converts it to the coverage-summary.json format that includes totals.
 */

const fs = require('fs');
const path = require('path');

const COVERAGE_FINAL_PATH = path.join(__dirname, '..', 'coverage', 'coverage-final.json');
const COVERAGE_SUMMARY_PATH = path.join(__dirname, '..', 'coverage', 'coverage-summary.json');

function calculateTotals(coverageData) {
  let totalLines = { total: 0, covered: 0, skipped: 0 };
  let totalStatements = { total: 0, covered: 0, skipped: 0 };
  let totalFunctions = { total: 0, covered: 0, skipped: 0 };
  let totalBranches = { total: 0, covered: 0, skipped: 0 };

  // Iterate through all files (excluding the schema/hash keys)
  Object.keys(coverageData).forEach((filePath) => {
    // Skip non-file keys like _coverageSchema
    if (filePath.startsWith('_')) {
      return;
    }

    const fileData = coverageData[filePath];
    
    // Calculate per-file metrics
    const lines = calculateFileMetrics(fileData, 's'); // statements map to lines
    const statements = calculateFileMetrics(fileData, 's');
    const functions = calculateFileMetrics(fileData, 'f');
    const branches = calculateFileMetrics(fileData, 'b');

    // Aggregate totals
    totalLines.total += lines.total;
    totalLines.covered += lines.covered;
    totalLines.skipped += lines.skipped;

    totalStatements.total += statements.total;
    totalStatements.covered += statements.covered;
    totalStatements.skipped += statements.skipped;

    totalFunctions.total += functions.total;
    totalFunctions.covered += functions.covered;
    totalFunctions.skipped += functions.skipped;

    totalBranches.total += branches.total;
    totalBranches.covered += branches.covered;
    totalBranches.skipped += branches.skipped;
  });

  // Calculate percentages
  const calculatePct = (covered, total) => {
    if (total === 0) return 100;
    return (covered / total) * 100;
  };

  return {
    lines: {
      total: totalLines.total,
      covered: totalLines.covered,
      skipped: totalLines.skipped,
      pct: calculatePct(totalLines.covered, totalLines.total),
    },
    statements: {
      total: totalStatements.total,
      covered: totalStatements.covered,
      skipped: totalStatements.skipped,
      pct: calculatePct(totalStatements.covered, totalStatements.total),
    },
    functions: {
      total: totalFunctions.total,
      covered: totalFunctions.covered,
      skipped: totalFunctions.skipped,
      pct: calculatePct(totalFunctions.covered, totalFunctions.total),
    },
    branches: {
      total: totalBranches.total,
      covered: totalBranches.covered,
      skipped: totalBranches.skipped,
      pct: calculatePct(totalBranches.covered, totalBranches.total),
    },
    branchesTrue: {
      total: 0,
      covered: 0,
      skipped: 0,
      pct: 100,
    },
  };
}

function calculateFileMetrics(fileData, type) {
  const map = type === 's' ? fileData.statementMap : 
              type === 'f' ? fileData.fnMap : 
              fileData.branchMap;
  const counts = type === 's' ? fileData.s : 
                 type === 'f' ? fileData.f : 
                 fileData.b;

  if (!map || !counts) {
    return { total: 0, covered: 0, skipped: 0 };
  }

  let total = 0;
  let covered = 0;
  let skipped = 0;

  Object.keys(map).forEach((key) => {
    total++;
    const count = counts[key];
    if (Array.isArray(count)) {
      // For branches, count as covered if any branch was executed
      const hasCoverage = count.some(c => c > 0);
      if (hasCoverage) {
        covered++;
      }
    } else if (count > 0) {
      covered++;
    }
  });

  return { total, covered, skipped };
}

function generateSummary() {
  try {
    // Check if coverage-final.json exists
    if (!fs.existsSync(COVERAGE_FINAL_PATH)) {
      console.error('❌ Coverage final file not found. Run "npm run test:coverage" first.');
      console.error(`   Expected path: ${COVERAGE_FINAL_PATH}`);
      process.exit(1);
    }

    // Read coverage-final.json
    const coverageFinal = JSON.parse(fs.readFileSync(COVERAGE_FINAL_PATH, 'utf8'));

    // Calculate totals
    const total = calculateTotals(coverageFinal);

    // Create summary format with total and individual file entries
    const summary = {
      total,
    };

    // Add individual file entries in the format expected by coverage-compare
    Object.keys(coverageFinal).forEach((filePath) => {
      if (filePath.startsWith('_')) {
        return; // Skip schema/hash keys
      }

      const fileData = coverageFinal[filePath];
      const lines = calculateFileMetrics(fileData, 's');
      const statements = calculateFileMetrics(fileData, 's');
      const functions = calculateFileMetrics(fileData, 'f');
      const branches = calculateFileMetrics(fileData, 'b');

      const calculatePct = (covered, total) => {
        if (total === 0) return 100;
        return (covered / total) * 100;
      };

      summary[filePath] = {
        lines: {
          total: lines.total,
          covered: lines.covered,
          skipped: lines.skipped,
          pct: calculatePct(lines.covered, lines.total),
        },
        statements: {
          total: statements.total,
          covered: statements.covered,
          skipped: statements.skipped,
          pct: calculatePct(statements.covered, statements.total),
        },
        functions: {
          total: functions.total,
          covered: functions.covered,
          skipped: functions.skipped,
          pct: calculatePct(functions.covered, functions.total),
        },
        branches: {
          total: branches.total,
          covered: branches.covered,
          skipped: branches.skipped,
          pct: calculatePct(branches.covered, branches.total),
        },
      };
    });

    // Write coverage-summary.json
    fs.writeFileSync(
      COVERAGE_SUMMARY_PATH,
      JSON.stringify(summary, null, 0) + '\n',
      'utf8'
    );

    console.log('✅ Coverage summary generated successfully!');
    console.log(`   Summary saved to: ${COVERAGE_SUMMARY_PATH}`);
    console.log(`   Total lines: ${total.lines.pct.toFixed(2)}%`);
    console.log(`   Total statements: ${total.statements.pct.toFixed(2)}%`);
    console.log(`   Total functions: ${total.functions.pct.toFixed(2)}%`);
    console.log(`   Total branches: ${total.branches.pct.toFixed(2)}%`);
  } catch (error) {
    console.error('❌ Error generating coverage summary:', error.message);
    process.exit(1);
  }
}

generateSummary();

