/**
 * @module with-ui
 * This module is special because it usees custom elements
 * and when you try registering them outside of content script you will get an error
 */

import {
  apiClient as desktopApiClient,
  SignatureParameters as DesktopSignatureParameters,
  AutogramDocument as DesktopAutogramDocument,
  SignResponseBody as DesktopSignResponseBody,
  SignatureParameters,
  UserCancelledSigningException,
} from "./autogram-api/index";

import { AutogramVMobileIntegrationInterfaceStateful } from "./avm-api/index";
import { AvmSimpleChannel } from "./channel";
import { Base64 } from "js-base64";
import { AutogramRoot } from "./injected-ui/main";
import { SigningMethod } from "./injected-ui/types";

export type SignedObject = DesktopSignResponseBody;
// We have to leave this in because otherwise the custom elements are not registered
export { AutogramRoot } from "./injected-ui/main";

console.log("CombinedClient");

/**
 * CombinedClient combines desktop and mobile signing methods with UI to choose between them
 */
export class CombinedClient {
  private client: ReturnType<typeof desktopApiClient>;
  private clientMobileIntegration: AutogramVMobileIntegrationInterfaceStateful;
  private ui: AutogramRoot;
  private signatureIndex = 1;
  private signerIdentificationListeners: (() => void)[];
  private resetSignRequestCallback?: () => void;

  /**
   * @param avmChannel - Autogram V Mobile Integration channel
   * @param resetSignRequestCallback - Callback to reset sign request
   */
  private constructor(
    ui: AutogramRoot,
    avmChannel: AutogramVMobileIntegrationInterfaceStateful = new AvmSimpleChannel(),
    resetSignRequestCallback?: () => void
  ) {
    let serverProtocol: "http" | "https" = "http";
    let serverHost = "localhost";

    if (isSafari()) {
      // Quick hack - mozno je lepsie urobit to ako fallback ak nefunguje http
      serverProtocol = "https";
      serverHost = "loopback.autogram.slovensko.digital";
    }

    this.ui = ui;

    this.client = desktopApiClient({
      serverProtocol,
      serverHost,
      disableSecurity: true,
      requestsOrigin: "*",
    });

    this.clientMobileIntegration = avmChannel;
    this.clientMobileIntegration.init();

    this.resetSignRequestCallback = resetSignRequestCallback;

    this.resetSignRequest();

    console.log("CombinedClient constructor end");
  }

  /**
   * We have to use async factory function because we have to wait for the UI to be created
   *
   */
  public static async init(
    avmChannel: AutogramVMobileIntegrationInterfaceStateful = new AvmSimpleChannel(),
    resetSignRequestCallback?: () => void
  ): Promise<CombinedClient> {
    console.log("CombinedClient init");
    async function createUI(): Promise<AutogramRoot> {
      const root: AutogramRoot = document.createElement(
        "autogram-root"
      ) as unknown as AutogramRoot;
      document.body.appendChild(root);

      await new Promise<void>((resolve, reject) => {
        try {
          console.log("CombinedClient init addEventListener");
          const resolved = false;
          const listener = root.addEventListener(
            "load",
            () => {
              console.log("CombinedClient init load event");
              if (!resolved) {
                resolve();
              }
            },
            { once: true }
          );
          if (root.isConnected) {
            console.log("CombinedClient init already connected", { root });
            resolve();
          }
        } catch (e) {
          console.error(e);
          reject(e);
        }
      });

      console.log({ root: root, ss: root.startSigning });

      return root as AutogramRoot;
    }

    console.log("CombinedClient init createUI");
    const ui = await createUI();

    console.log("CombinedClient init new CombinedClient");
    return new CombinedClient(ui, avmChannel, resetSignRequestCallback);
  }

  public setResetSignRequestCallback(callback: () => void) {
    if (this.resetSignRequestCallback !== undefined) {
      console.warn("resetSignRequestCallback already set");
    }
    if (typeof callback !== "function") {
      throw new Error("callback is not a function");
    }
    this.resetSignRequestCallback = callback;
  }

  private async _sign(
    document: DesktopAutogramDocument,
    signatureParameters: SignatureParameters,
    payloadMimeType: string
  ) {
    console.log("sign", this.ui);
    const signingMethod = await this.ui.startSigning();
    if (signingMethod === SigningMethod.reader) {
      const abortController = new AbortController();
      this.ui.desktopSigning(abortController);
      await this.launchDesktop(abortController);
      return this.getSignatureDesktop(
        document,
        signatureParameters,
        payloadMimeType
      );
    } else if (signingMethod === SigningMethod.mobile) {
      return this.getSignatureMobile(
        document,
        signatureParameters,
        payloadMimeType
      );
    } else {
      console.log("Invalid signing method");
      throw new Error("Invalid signing method");
    }
  }

  /**
   *
   * @param document document to sign
   * @param signatureParameters how to sign the document
   * @param payloadMimeType mime type of the input document
   * @param decodeBase64 if false the content will be (stay) base64 encoded, if true we will decode it
   * @returns
   */
  public async sign(
    document: DesktopAutogramDocument,
    signatureParameters: SignatureParameters,
    payloadMimeType: string,
    decodeBase64 = false
  ) {
    const signedObject = await this._sign(
      document,
      signatureParameters,
      payloadMimeType
    );
    return {
      ...signedObject,
      content: decodeBase64
        ? Base64.decode(signedObject.content)
        : signedObject.content,
    };
  }

  private async launchDesktop(abortController?: AbortController) {
    try {
      const info = await this.client.info();
      if (info.status != "READY") throw new Error("Wait for server");
      console.log(`Autogram ${info.version} is ready`);
    } catch (e) {
      console.error(e);
      const url = this.client.getLaunchURL();
      console.log(`Opening "${url}"`);
      window.location.assign(url);
      try {
        const info = await this.client.waitForStatus(
          "READY",
          100,
          5,
          abortController
        );
        console.log(`Autogram ${info.version} is ready`);
      } catch (e) {
        console.log("waiting for Autogram failed");
        console.error(e);
      }
    }
  }

  private async getSignatureDesktop(
    document: DesktopAutogramDocument,
    signatureParameters: DesktopSignatureParameters,
    payloadMimeType: string
  ): Promise<SignedObject> {
    console.log("getSignatureDesktop");
    return this.client
      .sign(document, signatureParameters, payloadMimeType)
      .then((signedObject) => {
        // TODO("restart SignRequest?");

        this.signerIdentificationListeners.forEach((cb) => cb());
        this.signerIdentificationListeners = [];
        this.signatureIndex++;

        this.ui.hide();
        this.ui.reset();

        return signedObject;
      })
      .catch((reason) => {
        if (reason instanceof UserCancelledSigningException) {
          console.log("User cancelled request");
          throw "User cancelled request"; // TODO: tu mozno nema byt error
        } else {
          console.error(reason);
          throw reason;
        }
      });
  }

  private async getSignatureMobile(
    document: DesktopAutogramDocument,
    signatureParameters: DesktopSignatureParameters,
    payloadMimeType: string
  ): Promise<SignedObject> {
    try {
      const params = signatureParameters;
      const container =
        params.container == null
          ? null
          : params.container == "ASiC_E"
          ? "ASiC-E"
          : "ASiC-S";

      await this.clientMobileIntegration.loadOrRegister();
      await this.clientMobileIntegration.addDocument({
        document: document,
        parameters: {
          ...params,
          container: container ?? undefined,
        },
        payloadMimeType: payloadMimeType,
      });
      const url = await this.clientMobileIntegration.getQrCodeUrl();
      console.log({ url });
      const abortController = new AbortController();
      this.ui.showQRCode(url, abortController);
      const signedObject = await this.clientMobileIntegration.waitForSignature(
        abortController
      );
      console.log({ signedObject });
      if (signedObject === null || signedObject === undefined) {
        throw new Error("Signing cancelled");
      }

      // const signedObject2 = {
      //   content: signedObject.content,
      //   signedBy:
      //     signedObject.signers?.at(-1)?.signedBy ?? "Používateľ Autogramu",
      //   issuedBy: signedObject.signers?.at(-1)?.issuedBy ?? "(neznámy)",
      // };

      this.signerIdentificationListeners.forEach((cb) => cb());
      this.signerIdentificationListeners = [];
      this.signatureIndex++;

      this.ui.hide();

      this.clientMobileIntegration.reset();
      this.ui.reset();
      return {
        content: signedObject.content,
        signedBy:
          signedObject.signers?.at(-1)?.signedBy ?? "Používateľ Autogramu",
        issuedBy: signedObject.signers?.at(-1)?.issuedBy ?? "(neznámy)",
      };
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  /**
   * reset sign request, so callbacks and signature index are reset
   */
  public resetSignRequest() {
    this.signerIdentificationListeners = [];
    this.resetSignRequestCallback?.(); // from outside - this.signRequest = new SignRequest();
  }

  /**
   *
   * @returns signature index (incremented after each signature)
   */
  public getSignatureIndex() {
    return this.signatureIndex;
  }
}

/**
 *
 * @returns true if the browser is Safari (heuristic based on navigator.userAgent)
 */
export function isSafari(): boolean {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}
