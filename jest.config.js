const nextJest = require('next/jest');

/** @type {import('jest').Config} */
const createJestConfig = nextJest({
  // Path to Next.js app root so next/jest can load next.config.js and .env files
  dir: './',
});

const config = {
  testEnvironment: 'node',
  moduleNameMapper: {
    // Map the @/* alias used throughout the project
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
};

module.exports = createJestConfig(config);
