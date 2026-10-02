// Jest setup file
import '@testing-library/jest-native/extend-expect';

// Handle unhandled promise rejections and uncaught exceptions
// These handlers ensure that background async errors surface as test failures
// rather than silently causing CI to exit with code 1
process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection in tests:', err);
  // Fail fast so CI shows the root cause
  throw err;
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception in tests:', err);
  throw err;
});

// Note: AsyncStorage mock is configured in package.json setupFiles
// Note: expo-secure-store should be mocked in individual test files
// All test files that use SecureStore should ensure deleteItemAsync is properly mocked
