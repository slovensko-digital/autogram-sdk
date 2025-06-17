import { test, expect } from '@playwright/test';

test.describe('CombinedClient Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Create a test page
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>CombinedClient Tests</title>
        </head>
        <body>
          <h1>CombinedClient Tests</h1>
          <div id="log"></div>
          <div id="result"></div>
          <button id="test-desktop">Test Desktop Signing</button>
          <button id="test-mobile">Test Mobile Signing</button>
          <button id="test-error">Test Error Handling</button>
          
          <script>
            function log(message) {
              const logElement = document.getElementById('log');
              logElement.innerHTML += message + '<br>';
            }
            
            // Mock AutogramRoot element
            class MockAutogramRoot extends HTMLElement {
              constructor() {
                super();
                this._signingMethod = 'reader'; // Default to desktop
              }
              
              set signingMethod(method) {
                this._signingMethod = method;
              }
              
              async startSigning() {
                log('AutogramRoot.startSigning() called');
                return this._signingMethod;
              }
              
              desktopSigning() {
                log('AutogramRoot.desktopSigning() called');
              }
              
              hide() {
                log('AutogramRoot.hide() called');
              }
              
              reset() {
                log('AutogramRoot.reset() called');
              }
            }
            
            // Register the custom element
            if (!customElements.get('autogram-root')) {
              customElements.define('autogram-root', MockAutogramRoot);
            }
            
            async function testDesktopSigning() {
              log('Testing desktop signing...');
              const result = document.getElementById('result');
              
              try {
                // Set the signing method to desktop
                document.querySelector('autogram-root').signingMethod = 'reader';
                
                // Initialize the CombinedClient
                const client = await window.AutogramSDK.CombinedClient.init();
                
                // Sign a document
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
                
                result.textContent = JSON.stringify({
                  success: true,
                  method: 'desktop',
                  content: signedObject.content.substring(0, 30) + '...'
                });
              } catch (error) {
                result.textContent = JSON.stringify({
                  success: false,
                  error: error.message
                });
              }
            }
            
            async function testMobileSigning() {
              log('Testing mobile signing...');
              const result = document.getElementById('result');
              
              try {
                // Set the signing method to mobile
                document.querySelector('autogram-root').signingMethod = 'mobile';
                
                // Initialize the CombinedClient
                const client = await window.AutogramSDK.CombinedClient.init();
                
                // Sign a document
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
                
                result.textContent = JSON.stringify({
                  success: true,
                  method: 'mobile',
                  content: signedObject.content.substring(0, 30) + '...'
                });
              } catch (error) {
                result.textContent = JSON.stringify({
                  success: false,
                  error: error.message
                });
              }
            }
            
            async function testErrorHandling() {
              log('Testing error handling...');
              const result = document.getElementById('result');
              
              try {
                // Set the signing method to desktop
                document.querySelector('autogram-root').signingMethod = 'reader';
                
                // Initialize the CombinedClient
                const client = await window.AutogramSDK.CombinedClient.init();
                
                // Make the desktop signing method throw an error
                client.clientDesktopIntegration.sign = () => {
                  throw new Error('Simulated signing error');
                };
                
                // Try to sign a document
                await client.sign(
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
                
                result.textContent = JSON.stringify({
                  success: true,
                  unexpected: 'This should not happen'
                });
              } catch (error) {
                result.textContent = JSON.stringify({
                  success: false,
                  error: error.message
                });
              }
            }
            
            document.getElementById('test-desktop').addEventListener('click', testDesktopSigning);
            document.getElementById('test-mobile').addEventListener('click', testMobileSigning);
            document.getElementById('test-error').addEventListener('click', testErrorHandling);
          </script>
        </body>
      </html>
    `);
    
    // Mock the CombinedClient and its dependencies
    await page.addScriptTag({ content: `
      window.AutogramSDK = {
        CombinedClient: class {
          constructor(ui, clientMobileIntegration, clientDesktopIntegration) {
            this.ui = ui;
            this.clientMobileIntegration = clientMobileIntegration;
            this.clientDesktopIntegration = clientDesktopIntegration;
            this.signerIdentificationListeners = [];
            this.signatureIndex = 1;
          }
          
          static async init() {
            // Create a mock UI
            const root = document.createElement('autogram-root');
            document.body.appendChild(root);
            
            // Create mock channels
            const mobileChannel = {
              init: async () => true,
              sign: async (document, parameters) => ({
                content: 'Signed with Mobile: ' + document.content,
                timestamp: new Date().toISOString(),
                signatureId: 'mock-mobile-signature-id'
              })
            };
            
            const desktopChannel = {
              info: async () => ({
                status: 'READY',
                version: '1.0.0'
              }),
              sign: async (document, parameters) => ({
                content: 'Signed with Desktop: ' + document.content,
                mimeType: 'application/vnd.etsi.asic-e+zip',
                signatureId: 'mock-desktop-signature-id'
              }),
              getLaunchURL: async () => 'autogram://launch'
            };
            
            return new this(root, mobileChannel, desktopChannel);
          }
          
          async sign(document, signatureParameters, payloadMimeType, decodeBase64) {
            const signedObject = await this.signBasedOnUserChoice(
              document,
              signatureParameters,
              payloadMimeType
            );
            
            return {
              ...signedObject,
              content: decodeBase64
                ? signedObject.content
                : signedObject.content
            };
          }
          
          async signBasedOnUserChoice(document, signatureParameters, payloadMimeType) {
            const signingMethod = await this.ui.startSigning();
            
            if (signingMethod === 'reader') {
              const abortController = new AbortController();
              this.ui.desktopSigning(abortController);
              await this.launchDesktop(abortController);
              return this.getSignatureDesktop(
                document,
                signatureParameters,
                payloadMimeType
              );
            } else if (signingMethod === 'mobile') {
              return this.getSignatureMobile(
                document,
                signatureParameters,
                payloadMimeType
              );
            } else {
              throw new Error('Invalid signing method');
            }
          }
          
          async launchDesktop() {
            const info = await this.clientDesktopIntegration.info();
            return info;
          }
          
          async getSignatureDesktop(document, signatureParameters, payloadMimeType) {
            const signedObject = await this.clientDesktopIntegration.sign(
              document,
              signatureParameters,
              payloadMimeType
            );
            
            this.signerIdentificationListeners.forEach(cb => cb());
            this.signerIdentificationListeners = [];
            this.signatureIndex++;
            
            this.ui.hide();
            this.ui.reset();
            
            return signedObject;
          }
          
          async getSignatureMobile(document, signatureParameters, payloadMimeType) {
            return this.clientMobileIntegration.sign(document, signatureParameters);
          }
        }
      };
    ` });
  });
  
  test('should sign a document using the desktop method', async ({ page }) => {
    // Click the button to test desktop signing
    await page.click('#test-desktop');
    
    // Wait for the result
    await page.waitForSelector('#result:not(:empty)');
    
    // Get the result and parse it
    const resultText = await page.textContent('#result');
    const result = JSON.parse(resultText || '{}');
    
    // Check the logs for the UI interaction
    const logs = await page.textContent('#log');
    
    // Assertions
    expect(result.success).toBe(true);
    expect(result.method).toBe('desktop');
    expect(logs).toContain('AutogramRoot.startSigning() called');
    expect(logs).toContain('AutogramRoot.desktopSigning() called');
    expect(logs).toContain('AutogramRoot.hide() called');
    expect(logs).toContain('AutogramRoot.reset() called');
  });
  
  test('should sign a document using the mobile method', async ({ page }) => {
    // Click the button to test mobile signing
    await page.click('#test-mobile');
    
    // Wait for the result
    await page.waitForSelector('#result:not(:empty)');
    
    // Get the result and parse it
    const resultText = await page.textContent('#result');
    const result = JSON.parse(resultText || '{}');
    
    // Check the logs for the UI interaction
    const logs = await page.textContent('#log');
    
    // Assertions
    expect(result.success).toBe(true);
    expect(result.method).toBe('mobile');
    expect(logs).toContain('AutogramRoot.startSigning() called');
    expect(logs).not.toContain('AutogramRoot.desktopSigning() called');
  });
  
  test('should handle errors during signing', async ({ page }) => {
    // Click the button to test error handling
    await page.click('#test-error');
    
    // Wait for the result
    await page.waitForSelector('#result:not(:empty)');
    
    // Get the result and parse it
    const resultText = await page.textContent('#result');
    const result = JSON.parse(resultText || '{}');
    
    // Assertions
    expect(result.success).toBe(false);
    expect(result.error).toBe('Simulated signing error');
  });
});
