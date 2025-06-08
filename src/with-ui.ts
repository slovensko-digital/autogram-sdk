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
  UserCancelledSigningException as DesktopUserCancelledSigningException,
} from "./autogram-api/index";

import { AutogramVMobileIntegrationInterfaceStateful } from "./avm-api/index";
import { AvmSimpleChannel } from "./channel-avm";
import { Base64 } from "js-base64";
import { AutogramRoot } from "./injected-ui/main";
import { SigningMethod } from "./injected-ui/types";
import { AutogramDesktopIntegrationInterface } from "./autogram-api/lib/apiClient";
import { AutogramDesktopSimpleChannel } from "./channel-desktop";
import { createLogger } from "./log";
import { UserCancelledSigningException } from "./errors";


export type SignedObject = DesktopSignResponseBody;
// We have to leave this in because otherwise the custom elements are not registered
export { AutogramRoot } from "./injected-ui/main";

const log = createLogger("ag-sdk.CombinedClient");

/**
 * CombinedClient combines desktop and mobile signing methods with UI to choose between them
 *
 * @class CombinedClient
 * @module with-ui
 * @param avmChannel - implementing Autogram V Mobile interface. It can be used to bind SDK to service worker.
 * @param desktopChannel - implementing Autogram Desktop interface. It can be used to bind SDK to service worker.
 * @param resetSignRequestCallback - Callback to reset sign request
 */
export class CombinedClient {
  private signatureIndex = 1;
  private signerIdentificationListeners: (() => void)[];

  /**
   * @param avmChannel - Autogram V Mobile Integration channel
   * @param resetSignRequestCallback - Callback to reset sign request
   */
  private constructor(
    private ui: AutogramRoot,
    private clientMobileIntegration: AutogramVMobileIntegrationInterfaceStateful = new AvmSimpleChannel(),
    private clientDesktopIntegration: AutogramDesktopIntegrationInterface = new AutogramDesktopSimpleChannel(),
    private resetSignRequestCallback: (() => void) | undefined = undefined,
  ) {
    // this.ui = ui;

    // this.clientDesktopIntegration = clientDesktopIntegration;

    // this.clientMobileIntegration = avmChannel;
    this.clientMobileIntegration.init();

    // this.resetSignRequestCallback = resetSignRequestCallback;

    this.resetSignRequest();

    log.debug("CombinedClient constructor end");
  }

  /**
   * We have to use async factory function because we have to wait for the UI to be created
   *
   */
  public static async init(
    clientMobileIntegration: AutogramVMobileIntegrationInterfaceStateful = new AvmSimpleChannel(),
    clientDesktopIntegration: AutogramDesktopIntegrationInterface = new AutogramDesktopSimpleChannel(),
    resetSignRequestCallback?: () => void
  ): Promise<CombinedClient> {
    // TODO: WIP 
    log.debug("init");
    async function createUI(): Promise<AutogramRoot> {
      const root: AutogramRoot = document.createElement(
        "autogram-root"
      ) as unknown as AutogramRoot;
      document.body.appendChild(root);

      await new Promise<void>((resolve, reject) => {
        try {
          log.debug("CombinedClient init addEventListener");
          const resolved = false;
          const listener = root.addEventListener(
            "load",
            () => {
              log.debug("CombinedClient init load event");
              if (!resolved) {
                resolve();
              }
            },
            { once: true }
          );
          if (root.isConnected) {
            log.debug("CombinedClient init already connected", { root });
            resolve();
          }
        } catch (e) {
          log.error(e);
          reject(e);
        }
      });

      log.debug({ root: root, ss: root.startSigning });

      return root as AutogramRoot;
    }

    log.debug("CombinedClient init createUI");
    const ui = await createUI();

    log.debug("CombinedClient init new CombinedClient");
    return new CombinedClient(
      ui,
      clientMobileIntegration,
      clientDesktopIntegration,
      resetSignRequestCallback
    );
  }

  public setResetSignRequestCallback(callback: () => void) {
    if (this.resetSignRequestCallback !== undefined) {
      log.warn("resetSignRequestCallback already set");
    }
    if (typeof callback !== "function") {
      throw new Error("callback is not a function");
    }
    this.resetSignRequestCallback = callback;
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
    const signedObject = await this.signBasedOnUserChoice(
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

  private async signBasedOnUserChoice(
    document: DesktopAutogramDocument,
    signatureParameters: SignatureParameters,
    payloadMimeType: string
  ) {
    // TODO: remove
    log.debug("sign", this.ui);
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
      log.debug("Invalid signing method");
      throw new Error("Invalid signing method");
    }
  }

  private async launchDesktop(abortController?: AbortController) {
    try {
      const info = await this.clientDesktopIntegration.info();
      if (info.status != "READY") throw new Error("Wait for server");
      log.info(`Autogram ${info.version} is ready`);
    } catch (e) {
      log.error(e);
      const url = await this.clientDesktopIntegration.getLaunchURL();
      log.info(`Opening "${url}"`);
      window.location.assign(url);
      try {
        const info = await this.clientDesktopIntegration.waitForStatus(
          "READY",
          100,
          5,
          abortController
        );
        log.info(`Autogram ${info.version} is ready`);
      } catch (e) {
        log.error("waiting for Autogram failed");
        log.error(e);
      }
    }
  }

  private async getSignatureDesktop(
    document: DesktopAutogramDocument,
    signatureParameters: DesktopSignatureParameters,
    payloadMimeType: string
  ): Promise<SignedObject> {
    log.info("getSignatureDesktop");
    return this.clientDesktopIntegration
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
        if (reason instanceof DesktopUserCancelledSigningException) {
          log.info("User cancelled request");
          throw new UserCancelledSigningException();
        } else {
          log.error(reason);
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
      log.debug({ url });
      const abortController = new AbortController();
      this.ui.showQRCode(url, abortController);
      const signedObject = await this.clientMobileIntegration.waitForSignature(
        abortController
      );
      log.debug({ signedObject });
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
      log.error(e);
      throw e;
    }
  }

  /**
   * reset sign request, so callbacks and signature index are reset
   */
  public resetSignRequest() {
    this.signerIdentificationListeners = [];
    if (this.resetSignRequestCallback) {
      this.resetSignRequestCallback?.();
    } // from outside - this.signRequest = new SignRequest();
  }

  /**
   *
   * @returns signature index (incremented after each signature)
   */
  public getSignatureIndex() {
    return this.signatureIndex;
  }
}
