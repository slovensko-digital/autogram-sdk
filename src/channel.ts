import { get, set } from "idb-keyval";
import {
  AVMIntegrationDocument,
  AVMDocumentToSign,
  AVMSignedDocument,
} from ".";
import {
  AutogramVMobileIntegrationInterfaceStateful,
  AutogramVMobileIntegration,
} from "./avm-api/lib/apiClient";

export class AvmSimpleChannel
  implements AutogramVMobileIntegrationInterfaceStateful
{
  private apiClient = new AutogramVMobileIntegration({
    get,
    set,
  });

  private documentRef: AVMIntegrationDocument | null;
  private abortController: AbortController | null;

  init(): Promise<void> {
    return Promise.resolve();
  }
  async loadOrRegister(): Promise<void> {
    await this.apiClient.loadOrRegister();
  }
  async getQrCodeUrl(): Promise<string> {
    if (!this.documentRef) {
      throw new Error("Document not found");
    }
    return this.apiClient.getQrCodeUrl(this.documentRef);
  }
  async addDocument(documentToSign: AVMDocumentToSign): Promise<void> {
    this.documentRef = await this.apiClient.addDocument(
      documentToSign as unknown as AVMDocumentToSign
    );
  }
  async waitForSignature(): Promise<AVMSignedDocument> {
    const documentRef = this.documentRef;
    if (!documentRef) {
      throw new Error("Document not found");
    }
    // TODO abort when tab is closed
    this.abortController = new AbortController();

    const timeout = setTimeout(
      () => {
        if (this.abortController) this.abortController.abort("Timeout");
      },
      1000 * 60 * 60 * 2 // 2 hours
    );
    this.abortController.signal.addEventListener("abort", () => {
      clearTimeout(timeout);
    });
    const res = await this.apiClient.waitForSignature(
      documentRef,
      this.abortController
    );
    clearTimeout(timeout);
    console.log("res", res);
    return res;
  }

  async abortWaitForSignature(): Promise<void> {
    if (this.abortController) this.abortController.abort("Aborted");
  }
  async reset(): Promise<void> {
    this.documentRef = null;
    this.abortController = null;
  }
}
