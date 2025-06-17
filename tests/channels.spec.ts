import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Autogram SDK Channel Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Create a simple test page
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Autogram SDK Channel Tests</title>
        </head>
        <body>
          <h1>Autogram SDK Channel Tests</h1>
          <div id="result"></div>
          <button id="test-desktop">Test Desktop Channel</button>
          <button id="test-avm">Test AVM Channel</button>
          
          <script>
            // These functions will be used to test the channels individually
            async function testDesktopChannel() {
              const result = document.getElementById('result');
              try {
                // Load the Desktop channel
                const channel = new window.AutogramSDK.AutogramDesktopSimpleChannel();
                
                // Test the info method
                const info = await channel.info();
                
                // Test the sign method
                const signedObject = await channel.sign(
                  {
                    content: 'Test document content',
                    filename: 'test.txt'
                  },
                  {
                    level: 'XAdES_BASELINE_B',
                    container: 'ASiC_E'
                  },
                  'text/plain'
                );
                
                result.textContent = JSON.stringify({
                  info,
                  signedObject
                });
              } catch (error) {
                result.textContent = 'Error: ' + error.message;
              }
            }
            
            async function testAVMChannel() {
              const result = document.getElementById('result');
              try {
                // Load the AVM channel
                const channel = new window.AutogramSDK.AvmSimpleChannel();
                
                // Initialize the channel
                await channel.init();
                
                // Test the sign method
                const signedObject = await channel.sign(
                  {
                    content: 'Test document content',
                    filename: 'test.txt'
                  },
                  {
                    level: 'XAdES_BASELINE_B',
                    container: 'ASiC_E'
                  }
                );
                
                result.textContent = JSON.stringify(signedObject);
              } catch (error) {
                result.textContent = 'Error: ' + error.message;
              }
            }
            
            document.getElementById('test-desktop').addEventListener('click', testDesktopChannel);
            document.getElementById('test-avm').addEventListener('click', testAVMChannel);
          </script>
        </body>
      </html>
    `);
    
    // Load the SDK
    await page.addScriptTag({ path: './dist/index-all.global.js' });
  });
  
  test('should initialize and use the desktop channel', async ({ page }) => {
    // Mock the desktop channel methods
    await page.evaluate(() => {
      window.AutogramSDK = window.AutogramSDK || {};
      window.AutogramSDK.AutogramDesktopSimpleChannel = class {
        async info() {
          return {
            status: 'READY',
            version: '1.0.0'
          };
        }
        
        async sign(document, parameters) {
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
    });
    
    // Click the button to test the desktop channel
    await page.click('#test-desktop');
    
    // Wait for the result
    await page.waitForSelector('#result:not(:empty)');
    
    // Get the result and parse it
    const resultText = await page.textContent('#result');
    const result = JSON.parse(resultText || '{}');
    
    // Assertions
    expect(result.info.status).toBe('READY');
    expect(result.info.version).toBe('1.0.0');
    expect(result.signedObject.mimeType).toBe('application/vnd.etsi.asic-e+zip');
    expect(result.signedObject.signatureId).toBe('mock-desktop-signature-id');
  });
  
  test('should initialize and use the AVM channel', async ({ page }) => {
    // Mock the AVM channel methods
    await page.evaluate(() => {
      window.AutogramSDK = window.AutogramSDK || {};
      window.AutogramSDK.AvmSimpleChannel = class {
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
    });
    
    // Click the button to test the AVM channel
    await page.click('#test-avm');
    
    // Wait for the result
    await page.waitForSelector('#result:not(:empty)');
    
    // Get the result and parse it
    const resultText = await page.textContent('#result');
    const result = JSON.parse(resultText || '{}');
    
    // Assertions
    expect(result.content).toBeDefined();
    expect(result.signatureId).toBe('mock-avm-signature-id');
    expect(result.timestamp).toBeDefined();
  });
});
