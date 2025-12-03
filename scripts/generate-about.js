#!/usr/bin/env node

/**
 * Generates about.json from CHANGELOG.md
 * Parses the last 3 versions from a Keep a Changelog formatted file
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CHANGELOG_PATH = path.join(__dirname, '../CHANGELOG.md');
const OUTPUT_PATH = path.join(__dirname, '../frontend/src/about.json');

const PROJECT_INFO = {
  name: "URL Shortener",
  description: "A modern, serverless URL shortening service built with React, AWS Lambda, and DynamoDB. Features Google OAuth authentication, custom short URLs, TTL-based expiration, and comprehensive analytics.",
  repository: "https://github.com/arnaduga/url-shortener",
  license: "MIT"
};

/**
 * Parse changelog and extract the last N versions
 */
function parseChangelog(content, maxVersions = 3) {
  const lines = content.split('\n');
  const versions = [];
  let currentVersion = null;
  let currentSection = null;
  let inContent = false;

  for (const line of lines) {
    // Match version header: ## [v0.1] 2024 or ## [Unreleased]
    const versionMatch = line.match(/^##\s+\[([^\]]+)\](.*)$/);

    if (versionMatch) {
      // Save previous version if exists
      if (currentVersion) {
        versions.push(currentVersion);
      }

      // Stop if we have enough versions
      if (versions.length >= maxVersions) {
        break;
      }

      // Start new version
      const versionName = versionMatch[1];
      const versionDate = versionMatch[2].trim();

      currentVersion = {
        version: versionName,
        date: versionDate,
        changes: {
          added: [],
          changed: [],
          fixed: [],
          removed: []
        }
      };
      currentSection = null;
      inContent = true;
      continue;
    }

    if (!inContent) continue;

    // Match section headers: ### Added, ### Changed, etc.
    const sectionMatch = line.match(/^###\s+(Added|Changed|Fixed|Removed|Deprecated|Security)$/i);
    if (sectionMatch) {
      const sectionName = sectionMatch[1].toLowerCase();
      currentSection = sectionName;
      continue;
    }

    // Match bullet points: - item or * item
    const itemMatch = line.match(/^[-*]\s+(.+)$/);
    if (itemMatch && currentSection && currentVersion) {
      const item = itemMatch[1].trim();

      // Map section names to our structure
      if (currentSection === 'added') {
        currentVersion.changes.added.push(item);
      } else if (currentSection === 'changed') {
        currentVersion.changes.changed.push(item);
      } else if (currentSection === 'fixed') {
        currentVersion.changes.fixed.push(item);
      } else if (currentSection === 'removed') {
        currentVersion.changes.removed.push(item);
      }
    }
  }

  // Don't forget the last version
  if (currentVersion) {
    versions.push(currentVersion);
  }

  return versions;
}

/**
 * Main execution
 */
try {
  console.log('Reading CHANGELOG.md...');
  const changelogContent = fs.readFileSync(CHANGELOG_PATH, 'utf8');

  console.log('Parsing changelog...');
  const versions = parseChangelog(changelogContent, 3);

  console.log(`Found ${versions.length} versions`);

  const aboutData = {
    ...PROJECT_INFO,
    versions: versions,
    generatedAt: new Date().toISOString()
  };

  console.log('Writing about.json...');
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(aboutData, null, 2), 'utf8');

  console.log('✓ Successfully generated about.json');
  console.log(`  Location: ${OUTPUT_PATH}`);
  console.log(`  Versions included: ${versions.map(v => v.version).join(', ')}`);

} catch (error) {
  console.error('✗ Error generating about.json:', error.message);
  process.exit(1);
}
