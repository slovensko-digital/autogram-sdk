import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Mock implementation of the AvmSimpleChannel and AutogramDesktopSimpleChannel
class MockAvmChannel {
  async init() {
    return true;
  }
  
  async sign(document, parameters) {
    return {
      content: Buffer.from('Signed with AVM: ' + document.content).toString('base64'),
      timestamp: new Date().toISOString(),
      signatureId: 'mock-avm-signature-id'
    };
  }
}

class MockDesktopChannel {
  async info() {
    return {
      status: 'READY',
      version: '1.0.0'
    };
  }
  
  async sign(document, parameters) {
    return {
      content: Buffer.from('Signed with Desktop: ' + document.content).toString('base64'),
      mimeType: 'application/vnd.etsi.asic-e+zip',
      signatureId: 'mock-desktop-signature-id'
    };
  }
  
  async getLaunchURL() {
    return 'autogram://launch';
  }
}

// Helper function to create a temporary text file for testing
async function createTempTextFile(content: string): Promise<string> {
  const tempDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const filePath = path.join(tempDir, `test-${Date.now()}.txt`);
  fs.writeFileSync(filePath, content);
  return filePath;
}

// Helper to setup mocks in the browser context
async function setupSDKMocks(page: Page) {
  await page.addInitScript(() => {
    // Mock the AvmSimpleChannel class
    window.AvmSimpleChannel = class {
      async init() {
        return true;
      }
      
      async sign(document, parameters) {
        return {
          content: btoa('Signed with AVM: ' + document.content),
          timestamp: new Date().toISOString(),
          signatureId: 'mock-avm-signature-id'
        };
      }
    };
    
    // Mock the AutogramDesktopSimpleChannel class
    window.AutogramDesktopSimpleChannel = class {
      async info() {
        return {
          status: 'READY',
          version: '1.0.0'
        };
      }
      
      async sign(document, parameters, mimeType) {
        return {
          content: btoa('Signed with Desktop: ' + document.content),
          mimeType: 'application/vnd.etsi.asic-e+zip',
          signatureId: 'mock-desktop-signature-id'
        };
      }
      
      async getLaunchURL() {
        return 'autogram://launch';
      }
    };
    
    // Mock the startSigning method to return 'reader' or 'mobile' based on a global variable
    window.mockSigningMethod = 'reader'; // Default to desktop reader
  });
}

// Helper to create a simple test page with the SDK
async function createTestPage(page: Page) {
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Autogram SDK Test</title>
      </head>
      <body>
        <h1>Autogram SDK Test</h1>
        <div id="result"></div>
        <button id="sign-button">Sign Document</button>
        <select id="signing-method">
          <option value="reader">Desktop Reader</option>
          <option value="mobile">Mobile</option>
        </select>
        
        <script>
          // Function that will be replaced with actual SDK code during testing
          async function initAndSignDocument() {
            const signingMethod = document.getElementById('signing-method').value;
            window.mockSigningMethod = signingMethod;
            
            // This will be executed with the actual SDK
            const client = await window.AutogramSDK.CombinedClient.init(
              new window.AvmSimpleChannel(),
              new window.AutogramDesktopSimpleChannel()
            );

            // Mock AutogramRoot's startSigning to return the selected method
            client.ui = {
              startSigning: async () => window.mockSigningMethod,
              desktopSigning: () => {},
              hide: () => {},
              reset: () => {}
            };
            
            const signedObject = await client.sign(
              {
                content: 'Test document content',
                filename: 'test.txt'
              },
              {
                level: 'XAdES_BASELINE_B',
                container: 'ASiC_E'
              },
              'text/plain',
              true
            );
            
            document.getElementById('result').textContent = 
              'Signed with: ' + (signingMethod === 'reader' ? 'Desktop' : 'Mobile') + 
              ', Content: ' + signedObject.content.substring(0, 50);
              
            return signedObject;
          }
          
          document.getElementById('sign-button').addEventListener('click', async () => {
            try {
              await initAndSignDocument();
            } catch (error) {
              document.getElementById('result').textContent = 'Error: ' + error.message;
            }
          });
        </script>
      </body>
    </html>
  `);
}

test.describe('Autogram SDK Tests', () => {
  test.beforeEach(async ({ page }) => {
    await setupSDKMocks(page);
  });
  
  test('should initialize the SDK and sign a document with desktop reader', async ({ page }) => {
    await createTestPage(page);
    
    // Load the SDK
    await page.addScriptTag({ path: './dist/index-all.global.js' });
    
    // Select desktop reader method
    await page.selectOption('#signing-method', 'reader');
    
    // Click the sign button
    await page.click('#sign-button');
    
    // Wait for the result to be populated
    await page.waitForSelector('#result:not(:empty)');
    
    // Check that the document was signed with the desktop method
    const resultText = await page.textContent('#result');
    expect(resultText).toContain('Signed with: Desktop');
  });
  
  test('should initialize the SDK and sign a document with mobile', async ({ page }) => {
    await createTestPage(page);
    
    // Load the SDK
    await page.addScriptTag({ path: './dist/index-all.global.js' });
    
    // Select mobile method
    await page.selectOption('#signing-method', 'mobile');
    
    // Click the sign button
    await page.click('#sign-button');
    
    // Wait for the result to be populated
    await page.waitForSelector('#result:not(:empty)');
    
    // Check that the document was signed with the mobile method
    const resultText = await page.textContent('#result');
    expect(resultText).toContain('Signed with: Mobile');
  });
  
  test('should handle error when signing fails', async ({ page }) => {
    await createTestPage(page);
    
    // Load the SDK
    await page.addScriptTag({ path: './dist/index-all.global.js' });
    
    // Override the sign method to throw an error
    await page.evaluate(() => {
      const originalDesktopSign = window.AutogramDesktopSimpleChannel.prototype.sign;
      window.AutogramDesktopSimpleChannel.prototype.sign = function() {
        throw new Error('Signing failed');
      };
    });
    
    // Click the sign button
    await page.click('#sign-button');
    
    // Wait for the error message
    await page.waitForSelector('#result:not(:empty)');
    
    // Check that the error message is displayed
    const resultText = await page.textContent('#result');
    expect(resultText).toContain('Error:');
  });
});

test.describe('Demo HTML Integration Tests', () => {
  test('should load demo1.html with SDK', async ({ page }) => {
    // Override the SDK methods before loading the page
    await setupSDKMocks(page);
    
    // Navigate to the demo page
    await page.goto(`file://${path.resolve('./demo1.html')}`);
    
    // Check that the page loaded
    await expect(page.locator('h1')).toHaveText('Welcome to Autogram SDK');
    
    // Wait for the SDK to initialize (this might need adjustment based on actual implementation)
    await page.waitForTimeout(1000);
    
    // Check if the input element for file picking is created by the SDK
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();
  });
  
  test('should load demo2.html and sign a hardcoded document', async ({ page }) => {
    // Override the SDK methods before loading the page
    await setupSDKMocks(page);
    
    // Navigate to the demo page
    await page.goto(`file://${path.resolve('./demo2.html')}`);
    
    // Check that the page loaded
    await expect(page.locator('h1')).toHaveText('Welcome to Autogram SDK');
    
    // Check if the input element for file picking is created by the SDK
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();
    
    // Wait for the download link to appear (hardcoded document signing happens automatically)
    await page.waitForSelector('a[download]');
    
    // Check if the download link has the expected text
    const downloadLink = page.locator('a[download]');
    await expect(downloadLink).toContainText('Download hello.txt.asice');
  });
});
