/**
 * Utility functions for Autogram SDK testing
 */
import { Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * Creates a temporary file for testing
 * @param content Content to write to the file
 * @param fileName Name of the file to create
 * @returns Path to the created file
 */
export function createTempFile(content: string, fileName: string): string {
  const tempDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const filePath = path.join(tempDir, fileName);
  fs.writeFileSync(filePath, content);
  return filePath;
}

/**
 * Sets up mock SDK functionality in the page
 * @param page Playwright page object
 * @param options Configuration options for mocks
 */
export async function setupSDKMocks(page: Page, options: {
  defaultSigningMethod?: 'reader' | 'mobile',
  desktopError?: boolean,
  mobileError?: boolean
} = {}) {
  const defaultOptions = {
    defaultSigningMethod: 'reader',
    desktopError: false,
    mobileError: false,
    ...options
  };
  
  await page.addInitScript(({ defaultSigningMethod, desktopError, mobileError }) => {
    window.mockSigningMethod = defaultSigningMethod;
    
    // Mock the AutogramRoot element
    if (!customElements.get('autogram-root')) {
      customElements.define('autogram-root', class extends HTMLElement {
        async startSigning() {
          return window.mockSigningMethod;
        }
        
        desktopSigning() {}
        hide() {}
        reset() {}
      });
    }
    
    // Mock the SDK functionality
    window.AutogramSDK = window.AutogramSDK || {};
    
    // Mock AutogramDesktopSimpleChannel
    window.AutogramSDK.AutogramDesktopSimpleChannel = class {
      async info() {
        return {
          status: 'READY',
          version: '1.0.0'
        };
      }
      
      async sign(document, parameters) {
        if (desktopError) {
          throw new Error('Desktop signing error');
        }
        
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
    
    // Mock AvmSimpleChannel
    window.AutogramSDK.AvmSimpleChannel = class {
      async init() {
        return true;
      }
      
      async sign(document, parameters) {
        if (mobileError) {
          throw new Error('Mobile signing error');
        }
        
        return {
          content: btoa('Signed with Mobile: ' + document.content),
          timestamp: new Date().toISOString(),
          signatureId: 'mock-mobile-signature-id'
        };
      }
    };
    
    // Store the original CombinedClient implementation if it exists
    const originalCombinedClient = window.AutogramSDK.CombinedClient;
    
    // Override CombinedClient.init to use our mocks
    window.AutogramSDK.CombinedClient = class {
      static async init() {
        if (originalCombinedClient) {
          const client = await originalCombinedClient.init(
            new window.AutogramSDK.AvmSimpleChannel(),
            new window.AutogramSDK.AutogramDesktopSimpleChannel()
          );
          
          // Override the UI
          client.ui = document.createElement('autogram-root');
          return client;
        } else {
          // Provide a basic implementation if original doesn't exist
          const ui = document.createElement('autogram-root');
          const avmChannel = new window.AutogramSDK.AvmSimpleChannel();
          const desktopChannel = new window.AutogramSDK.AutogramDesktopSimpleChannel();
          
          return new this(ui, avmChannel, desktopChannel);
        }
      }
      
      constructor(ui, avmChannel, desktopChannel) {
        this.ui = ui;
        this.clientMobileIntegration = avmChannel;
        this.clientDesktopIntegration = desktopChannel;
        this.signerIdentificationListeners = [];
        this.signatureIndex = 1;
      }
      
      async sign(document, signatureParameters, payloadMimeType, decodeBase64 = false) {
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
  }, defaultOptions);
}

/**
 * Clean up temporary test files
 * @param filePaths Array of file paths to clean up
 */
export function cleanupTempFiles(filePaths: string[]) {
  for (const filePath of filePaths) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  
  // Try to remove the temp directory if it's empty
  const tempDir = path.join(__dirname, 'temp');
  if (fs.existsSync(tempDir) && fs.readdirSync(tempDir).length === 0) {
    fs.rmdirSync(tempDir);
  }
}
