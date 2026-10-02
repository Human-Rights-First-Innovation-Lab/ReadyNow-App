#!/usr/bin/env node

/**
 * Updates the coverage baseline file with current coverage metrics.
 * This script reads the current coverage summary and writes it to
 * .github/coverage-baseline.json for regression detection.
 */

const fs = require('fs');
const path = require('path');

const COVERAGE_SUMMARY_PATH = path.join(__dirname, '..', 'coverage', 'coverage-summary.json');
const BASELINE_PATH = path.join(__dirname, '..', '.github', 'coverage-baseline.json');

function updateBaseline() {
  try {
    // Check if coverage summary exists
    if (!fs.existsSync(COVERAGE_SUMMARY_PATH)) {
      console.error('❌ Coverage summary not found. Run "npm run test:coverage" first.');
      process.exit(1);
    }

    // Read current coverage
    const coverageSummary = JSON.parse(fs.readFileSync(COVERAGE_SUMMARY_PATH, 'utf8'));
    
    // Extract total coverage metrics
    const total = coverageSummary.total || {};
    
    // Create baseline structure
    const baseline = {
      timestamp: new Date().toISOString(),
      total: {
        lines: total.lines?.pct || 0,
        statements: total.statements?.pct || 0,
        functions: total.functions?.pct || 0,
        branches: total.branches?.pct || 0,
      },
    };

    // Ensure .github directory exists
    const githubDir = path.dirname(BASELINE_PATH);
    if (!fs.existsSync(githubDir)) {
      fs.mkdirSync(githubDir, { recursive: true });
    }

    // Write baseline file with pretty formatting
    fs.writeFileSync(
      BASELINE_PATH,
      JSON.stringify(baseline, null, 2) + '\n',
      'utf8'
    );

    console.log('✅ Coverage baseline updated successfully!');
    console.log(`   Baseline saved to: ${BASELINE_PATH}`);
    console.log(`   Lines: ${baseline.total.lines}%`);
    console.log(`   Statements: ${baseline.total.statements}%`);
    console.log(`   Functions: ${baseline.total.functions}%`);
    console.log(`   Branches: ${baseline.total.branches}%`);
  } catch (error) {
    console.error('❌ Error updating coverage baseline:', error.message);
    process.exit(1);
  }
}

updateBaseline();

