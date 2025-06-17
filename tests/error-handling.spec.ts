import { test, expect } from '@playwright/test';
import { setupSDKMocks, createTempFile, cleanupTempFiles } from './utils';

test.describe('Error Handling Tests', () => {
  let testFilePaths: string[] = [];
  
  test.beforeEach(async ({ page }) => {
    // Create a test page
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>SDK Error Handling Tests</title>
        </head>
        <body>
          <h1>SDK Error Handling Tests</h1>
          <div id="error-message"></div>
          <button id="test-desktop-error">Test Desktop Error</button>
          <button id="test-mobile-error">Test Mobile Error</button>
          <button id="test-user-cancelled">Test User Cancelled</button>
          
          <script>
            async function testDesktopError() {
              try {
                const client = await window.AutogramSDK.CombinedClient.init();
                
                // Ensure desktop signing method is used
                window.mockSigningMethod = 'reader';
                
                // Override desktop signing to throw an error
                client.clientDesktopIntegration.sign = () => {
                  throw new Error('Desktop signing failed');
                };
                
                await client.sign(
                  {
                    content: 'Test content',
                    filename: 'test.txt'
                  },
                  {
                    level: 'XAdES_BASELINE_B',
                    container: 'ASiC_E'
                  },
                  'text/plain',
                  true
                );
                
                document.getElementById('error-message').textContent = 'No error occurred';
              } catch (error) {
                document.getElementById('error-message').textContent = 'Error: ' + error.message;
              }
            }
            
            async function testMobileError() {
              try {
                const client = await window.AutogramSDK.CombinedClient.init();
                
                // Ensure mobile signing method is used
                window.mockSigningMethod = 'mobile';
                
                // Override mobile signing to throw an error
                client.clientMobileIntegration.sign = () => {
                  throw new Error('Mobile signing failed');
                };
                
                await client.sign(
                  {
                    content: 'Test content',
                    filename: 'test.txt'
                  },
                  {
                    level: 'XAdES_BASELINE_B',
                    container: 'ASiC_E'
                  },
                  'text/plain',
                  true
                );
                
                document.getElementById('error-message').textContent = 'No error occurred';
              } catch (error) {
                document.getElementById('error-message').textContent = 'Error: ' + error.message;
              }
            }
            
            async function testUserCancelled() {
              try {
                const client = await window.AutogramSDK.CombinedClient.init();
                
                // Ensure desktop signing method is used
                window.mockSigningMethod = 'reader';
                
                // Override desktop signing to throw a UserCancelledSigningException
                client.clientDesktopIntegration.sign = () => {
                  const error = new Error('User cancelled signing');
                  error.name = 'UserCancelledSigningException';
                  throw error;
                };
                
                await client.sign(
                  {
                    content: 'Test content',
                    filename: 'test.txt'
                  },
                  {
                    level: 'XAdES_BASELINE_B',
                    container: 'ASiC_E'
                  },
                  'text/plain',
                  true
                );
                
                document.getElementById('error-message').textContent = 'No error occurred';
              } catch (error) {
                document.getElementById('error-message').textContent = 'Error: ' + error.message;
              }
            }
            
            document.getElementById('test-desktop-error').addEventListener('click', testDesktopError);
            document.getElementById('test-mobile-error').addEventListener('click', testMobileError);
            document.getElementById('test-user-cancelled').addEventListener('click', testUserCancelled);
          </script>
        </body>
      </html>
    `);
    
    // Create test files
    const testFile = createTempFile('Test content for error handling', 'error-test.txt');
    testFilePaths.push(testFile);
    
    // Setup SDK mocks
    await setupSDKMocks(page);
    
    // Load the SDK
    await page.addScriptTag({ path: './dist/index-all.global.js' });
  });
  
  test.afterEach(() => {
    // Clean up test files
    cleanupTempFiles(testFilePaths);
    testFilePaths = [];
  });
  
  test('should handle desktop signing errors', async ({ page }) => {
    // Click the button to test desktop error
    await page.click('#test-desktop-error');
    
    // Wait for the error message
    await page.waitForSelector('#error-message:not(:empty)');
    
    // Check the error message
    const errorMessage = await page.textContent('#error-message');
    expect(errorMessage).toContain('Error: Desktop signing failed');
  });
  
  test('should handle mobile signing errors', async ({ page }) => {
    // Click the button to test mobile error
    await page.click('#test-mobile-error');
    
    // Wait for the error message
    await page.waitForSelector('#error-message:not(:empty)');
    
    // Check the error message
    const errorMessage = await page.textContent('#error-message');
    expect(errorMessage).toContain('Error: Mobile signing failed');
  });
  
  test('should handle user cancellation', async ({ page }) => {
    // Click the button to test user cancellation
    await page.click('#test-user-cancelled');
    
    // Wait for the error message
    await page.waitForSelector('#error-message:not(:empty)');
    
    // Check the error message
    const errorMessage = await page.textContent('#error-message');
    expect(errorMessage).toContain('Error: User cancelled signing');
  });
  
  test('should handle errors when using real demo pages', async ({ page }) => {
    // Setup mocks to simulate errors
    await setupSDKMocks(page, { desktopError: true });
    
    // Navigate to the demo page
    await page.goto(`file://${path.resolve('demo2.html')}`);
    
    // Wait for the page to load and for an error to occur
    // (the demo initializes and tries to sign automatically)
    await page.waitForTimeout(2000);
    
    // Check for error indicators on the page
    // This is a bit trickier since demo2.html might not have explicit error handling
    // We're looking for the absence of success indicators instead
    const downloadLinks = await page.locator('a[download]').count();
    expect(downloadLinks).toBe(0); // No download links should be created on error
  });
});
