#!/usr/bin/env node

/**
 * Compares current coverage against baseline and posts PR comments.
 * Fails if coverage drops by more than the threshold (default 5%).
 */

const fs = require("fs");
const path = require("path");
const { Octokit } = require("@octokit/rest");

const COVERAGE_SUMMARY_PATH = path.join(
  __dirname,
  "..",
  "coverage",
  "coverage-summary.json"
);
const BASELINE_PATH = path.join(
  __dirname,
  "..",
  ".github",
  "coverage-baseline.json"
);
const REGRESSION_THRESHOLD = 5; // 5% threshold for coverage regression

// Get environment variables
const githubToken = process.env.GITHUB_TOKEN;
const prNumber = process.env.PR_NUMBER;
const githubRepo = process.env.GITHUB_REPOSITORY || "";
const [repoOwner, repoName] = githubRepo.split("/");

function formatPercentage(value) {
  return typeof value === "number" ? value.toFixed(2) : "0.00";
}

function calculateChange(current, baseline) {
  if (!baseline || baseline === 0) return 0;
  return current - baseline;
}

function formatChange(change) {
  const sign = change >= 0 ? "+" : "";
  const color = change >= 0 ? "🟢" : "🔴";
  return `${color} ${sign}${formatPercentage(change)}%`;
}

function generateCoverageTable(current, baseline) {
  const metrics = [
    { name: "Lines", current: current.lines, baseline: baseline.lines },
    {
      name: "Statements",
      current: current.statements,
      baseline: baseline.statements,
    },
    {
      name: "Functions",
      current: current.functions,
      baseline: baseline.functions,
    },
    {
      name: "Branches",
      current: current.branches,
      baseline: baseline.branches,
    },
  ];

  const rows = metrics.map(({ name, current, baseline }) => {
    const change = calculateChange(current, baseline);
    return `| ${name} | ${formatPercentage(baseline)}% | ${formatPercentage(
      current
    )}% | ${formatChange(change)} |`;
  });

  return [
    "## 📊 Coverage Comparison",
    "",
    "| Metric | Baseline | Current | Change |",
    "|--------|----------|---------|--------|",
    ...rows,
    "",
  ].join("\n");
}

async function postPRComment(message) {
  if (!githubToken || !prNumber || !repoOwner || !repoName) {
    console.log("⚠️  Skipping PR comment (missing GitHub context)");
    return;
  }

  try {
    const octokit = new Octokit({ auth: githubToken });

    // Find existing coverage comment
    const { data: comments } = await octokit.rest.issues.listComments({
      owner: repoOwner,
      repo: repoName,
      issue_number: parseInt(prNumber, 10),
    });

    const botComment = comments.find(
      (comment) =>
        comment.user.type === "Bot" &&
        comment.body.includes("Coverage Comparison")
    );

    if (botComment) {
      // Update existing comment
      await octokit.rest.issues.updateComment({
        owner: repoOwner,
        repo: repoName,
        comment_id: botComment.id,
        body: message,
      });
      console.log("✅ Updated existing PR comment");
    } else {
      // Create new comment
      await octokit.rest.issues.createComment({
        owner: repoOwner,
        repo: repoName,
        issue_number: parseInt(prNumber, 10),
        body: message,
      });
      console.log("✅ Posted new PR comment");
    }
  } catch (error) {
    console.error("⚠️  Failed to post PR comment:", error.message);
    // Don't fail the build if comment posting fails
  }
}

function compareCoverage() {
  try {
    // Check if coverage summary exists
    if (!fs.existsSync(COVERAGE_SUMMARY_PATH)) {
      console.error(
        '❌ Coverage summary not found. Run "npm run test:coverage" first.'
      );
      console.error(`   Expected path: ${COVERAGE_SUMMARY_PATH}`);

      // Check if coverage directory exists
      const coverageDir = path.dirname(COVERAGE_SUMMARY_PATH);
      if (fs.existsSync(coverageDir)) {
        console.error(`\n   Coverage directory exists. Contents:`);
        try {
          const files = fs.readdirSync(coverageDir);
          files.forEach((file) => {
            const filePath = path.join(coverageDir, file);
            const stats = fs.statSync(filePath);
            if (stats.isFile()) {
              console.error(`   - ${file}`);
            }
          });
        } catch (err) {
          console.error(`   (Could not read directory: ${err.message})`);
        }
      } else {
        console.error(`\n   Coverage directory does not exist: ${coverageDir}`);
        console.error(
          "   This suggests tests were not run with coverage enabled."
        );
      }

      process.exit(1);
    }

    // Check if baseline exists
    if (!fs.existsSync(BASELINE_PATH)) {
      console.warn("⚠️  Baseline file not found. Creating initial baseline...");
      console.warn(
        '   Run "npm run coverage:update-baseline" to set a baseline.'
      );

      // Create a zero baseline to allow first run
      const coverageSummary = JSON.parse(
        fs.readFileSync(COVERAGE_SUMMARY_PATH, "utf8")
      );
      const total = coverageSummary.total || {};
      const zeroBaseline = {
        timestamp: new Date().toISOString(),
        total: {
          lines: total.lines?.pct || 0,
          statements: total.statements?.pct || 0,
          functions: total.functions?.pct || 0,
          branches: total.branches?.pct || 0,
        },
      };
      fs.writeFileSync(
        BASELINE_PATH,
        JSON.stringify(zeroBaseline, null, 2) + "\n",
        "utf8"
      );
      console.log("✅ Created initial baseline from current coverage");
    }

    // Read current coverage
    const coverageSummary = JSON.parse(
      fs.readFileSync(COVERAGE_SUMMARY_PATH, "utf8")
    );
    const currentTotal = coverageSummary.total || {};
    const current = {
      lines: currentTotal.lines?.pct || 0,
      statements: currentTotal.statements?.pct || 0,
      functions: currentTotal.functions?.pct || 0,
      branches: currentTotal.branches?.pct || 0,
    };

    // Read baseline
    const baselineData = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
    const baseline = {
      lines: baselineData.total?.lines || 0,
      statements: baselineData.total?.statements || 0,
      functions: baselineData.total?.functions || 0,
      branches: baselineData.total?.branches || 0,
    };

    // Calculate changes
    const changes = {
      lines: calculateChange(current.lines, baseline.lines),
      statements: calculateChange(current.statements, baseline.statements),
      functions: calculateChange(current.functions, baseline.functions),
      branches: calculateChange(current.branches, baseline.branches),
    };

    // Check for regressions
    const regressions = Object.entries(changes).filter(
      ([_, change]) => change < -REGRESSION_THRESHOLD
    );
    const hasRegression = regressions.length > 0;

    // Generate report
    const table = generateCoverageTable(current, baseline);
    const summary = hasRegression
      ? `\n❌ **Coverage regression detected!** Coverage dropped by more than ${REGRESSION_THRESHOLD}%.\n`
      : `\n✅ **Coverage check passed!** No significant regressions detected.\n`;

    const report = table + summary;

    // Post PR comment if in CI
    if (githubToken && prNumber) {
      postPRComment(report);
    } else {
      // Print to console in local runs
      console.log("\n" + report);
    }

    // Exit with error if regression detected
    if (hasRegression) {
      console.error(
        "\n❌ Coverage regression exceeds threshold. Please improve test coverage."
      );
      process.exit(1);
    }

    console.log("\n✅ Coverage check passed!");
  } catch (error) {
    console.error("❌ Error comparing coverage:", error.message);
    process.exit(1);
  }
}

compareCoverage();
