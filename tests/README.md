# Autogram SDK Tests

This directory contains Playwright tests for the Autogram SDK.

## Test Structure

The tests are organized into several categories:

1. **SDK Tests** (`sdk.spec.ts`): Tests for the main SDK functionality, including initializing the client and signing documents with both desktop and mobile methods.

2. **Channel Tests** (`channels.spec.ts`): Tests for the individual channel implementations (Desktop and AVM).

3. **Combined Client Tests** (`combined-client.spec.ts`): Tests specific to the `CombinedClient` class, which integrates both signing methods.

4. **Demo Integration Tests** (`demo-integration.spec.ts`): End-to-end tests for the demo HTML files included with the SDK.

5. **Error Handling Tests** (`error-handling.spec.ts`): Tests for various error scenarios.

## Running Tests

You can run the tests using the following npm scripts:

```bash
# Run all tests
npm test

# Run tests with UI mode (for debugging)
npm run test:ui

# Run tests with debugging
npm run test:debug

# Run specific test categories
npm run test:channels
npm run test:client
npm run test:sdk
npm run test:demo
```

## Test Utilities

The `utils.ts` file contains helper functions for testing:

- `createTempFile`: Creates temporary files for testing
- `setupSDKMocks`: Sets up mocks for the SDK in the Playwright page
- `cleanupTempFiles`: Cleans up temporary files after tests

## Mocking Strategy

The tests use a combination of approaches to mock the SDK functionality:

1. **Browser Mocks**: Using `page.addInitScript()` to inject mock implementations of the SDK classes.
2. **Custom Elements**: Mocking the `autogram-root` custom element to control the signing method selection.
3. **Test Pages**: Creating simplified test pages with controlled environments.

## Prerequisites

Before running the tests, make sure to:

1. Build the SDK:
   ```bash
   npm run build
   ```

2. Install Playwright browsers:
   ```bash
   npx playwright install
   ```

## Test Implementation Notes

- The tests mock the signing functionality rather than relying on actual signing implementations.
- Both desktop and mobile signing paths are tested.
- Error handling is tested for various scenarios.
- The demo HTML files are tested with mocked SDK functionality.

## Adding New Tests

When adding new tests:

1. Use the existing utility functions in `utils.ts`.
2. Ensure you're properly mocking any external dependencies.
3. Follow the pattern of setting up a controlled test environment.
4. Clean up any resources created during tests.
