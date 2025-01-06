import {
  AutogramVMobileIntegrationInterfaceStateful,
  desktopApiClient,
  DesktopAutogramDocument,
  DesktopSignatureParameters,
  DesktopSignResponseBody,
} from ".";
import {
  SignatureParameters,
  UserCancelledSigningException,
} from "./autogram-api/lib/apiClient";
import { AvmSimpleChannel } from "./channel";
import { AutogramRoot, createUI, SigningMethod } from "./injected-ui";
import { Base64 } from "js-base64";

export type SignedObject = DesktopSignResponseBody;


console.log("FullClient");
export class FullClient {
  private client: ReturnType<typeof desktopApiClient>;
  private clientMobileIntegration: AutogramVMobileIntegrationInterfaceStateful;
  private ui: AutogramRoot;
  private signatureIndex = 1;
  private signerIdentificationListeners: (() => void)[];
  private resetSignRequestCallback?: () => void;

  public constructor(
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

    this.ui = createUI();

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
  }

  private async _sign(
    document: DesktopAutogramDocument,
    signatureParameters: SignatureParameters,
    payloadMimeType: string
  ) {
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

  public resetSignRequest() {
    this.signerIdentificationListeners = [];
    this.resetSignRequestCallback?.(); // from outside - this.signRequest = new SignRequest();
  }

  public getSignatureIndex() {
    return this.signatureIndex;
  }
}

export function isSafari(): boolean {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}
