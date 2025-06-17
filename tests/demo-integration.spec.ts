import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Helper function to create a temporary file for testing
function createTempFile(content: string, fileName: string): string {
  const tempDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const filePath = path.join(tempDir, fileName);
  fs.writeFileSync(filePath, content);
  return filePath;
}

test.describe('Demo Files End-to-End Tests', () => {
  let testFilePath: string;
  
  test.beforeEach(async ({ page }) => {
    // Create a test file
    testFilePath = createTempFile('This is a test document', 'test-document.txt');
    
    // Mock the SDK functionality
    await page.addInitScript(() => {
      window.AutogramSDK = window.AutogramSDK || {};
      
      // Mock CombinedClient
      window.AutogramSDK.CombinedClient = class {
        static async init() {
          const mockUI = {
            startSigning: async () => 'reader', // Default to desktop signing
            desktopSigning: () => {},
            hide: () => {},
            reset: () => {}
          };
          
          const mockMobileChannel = {
            init: async () => true,
            sign: async (document, parameters) => ({
              content: btoa('Signed with Mobile: ' + document.content),
              timestamp: new Date().toISOString(),
              signatureId: 'mock-mobile-signature-id'
            })
          };
          
          const mockDesktopChannel = {
            info: async () => ({
              status: 'READY',
              version: '1.0.0'
            }),
            sign: async (document, parameters) => ({
              content: btoa('Signed with Desktop: ' + document.content),
              mimeType: 'application/vnd.etsi.asic-e+zip',
              signatureId: 'mock-desktop-signature-id'
            }),
            getLaunchURL: async () => 'autogram://launch'
          };
          
          return new this(mockUI, mockMobileChannel, mockDesktopChannel);
        }
        
        constructor(ui, mobileChannel, desktopChannel) {
          this.ui = ui;
          this.clientMobileIntegration = mobileChannel;
          this.clientDesktopIntegration = desktopChannel;
          this.signerIdentificationListeners = [];
          this.signatureIndex = 1;
        }
        
        async sign(document, signatureParameters, payloadMimeType, decodeBase64) {
          // Simulate signing process
          const signingMethod = await this.ui.startSigning();
          
          let signedObject;
          if (signingMethod === 'reader') {
            signedObject = await this.clientDesktopIntegration.sign(
              document,
              signatureParameters,
              payloadMimeType
            );
          } else {
            signedObject = await this.clientMobileIntegration.sign(
              document,
              signatureParameters
            );
          }
          
          return {
            ...signedObject,
            content: decodeBase64
              ? atob(signedObject.content)
              : signedObject.content
          };
        }
      };
    });
  });
  
  test.afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });
  
  test('demo1.html should allow signing a file', async ({ page }) => {
    // Navigate to demo1.html
    await page.goto(`file://${path.resolve('demo1.html')}`);
    
    // Wait for the page to load
    await expect(page.locator('h1')).toHaveText('Welcome to Autogram SDK');
    
    // Wait for the file input to be created
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();
    
    // Upload a test file
    await fileInput.setInputFiles(testFilePath);
    
    // Wait for the download link to appear
    await page.waitForSelector('a[download]');
    
    // Check the download link has the correct filename
    const downloadLink = page.locator('a[download]');
    await expect(downloadLink).toHaveAttribute('download', 'test-document.txt.asice');
  });
  
  test('demo2.html should sign hardcoded content and allow file upload', async ({ page }) => {
    // Navigate to demo2.html
    await page.goto(`file://${path.resolve('demo2.html')}`);
    
    // Wait for the page to load
    await expect(page.locator('h1')).toHaveText('Welcome to Autogram SDK');
    
    // Wait for the initial signing to complete (the hardcoded "Hello, World!")
    await page.waitForSelector('a[download="hello.txt.asice"]');
    
    // Check that the download link for the hardcoded content exists
    const helloLink = page.locator('a[download="hello.txt.asice"]');
    await expect(helloLink).toBeVisible();
    
    // Find the file input and upload a test file
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();
    await fileInput.setInputFiles(testFilePath);
    
    // Wait for the new download link to appear
    await page.waitForSelector('a[download="test-document.txt.asice"]');
    
    // Check the new download link has the correct filename
    const downloadLink = page.locator('a[download="test-document.txt.asice"]');
    await expect(downloadLink).toBeVisible();
  });
});
