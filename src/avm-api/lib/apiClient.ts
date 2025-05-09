// import fetch from "cross-fetch";
import { SignJWT } from "jose";
import z from "zod";
import { paths } from "./avm-api.generated";
import { Base64 } from "js-base64";
import { createLogger } from "../../log";

const log = createLogger("ag-sdk:AvmIntegration");

export interface AvmIntegrationDocument {
  guid: string | null;
  encryptionKey: string | null;
  lastModified: string | null;
}

/**
 * Stateful integration with Autogram v mobile
 */
export class AutogramVMobileIntegration
  implements AutogramVMobileIntegrationInterface
{
  private apiClient: AutogramVMobileIntegrationApiClient;

  /**
   * Key pair for encrypting documents sent to the server
   */
  private keyPair: CryptoKeyPair | null = null;
  /**
   * GUID of the integration - assigned by server
   */
  private integrationGuid: string | null = null;

  private _subtleCrypto: SubtleCrypto | null = null;
  private get subtleCrypto() {
    if (!this._subtleCrypto) {
      throw new Error("SubtleCrypto not available");
    }
    return this._subtleCrypto;
  }

  private db: DBInterface;

  public constructor(db: DBInterface) {
    this.apiClient = new AutogramVMobileIntegrationApiClient();
    this.db = db;
  }

  public async loadOrRegister() {
    this.loadSubtleCrypto();
    // load
    this.keyPair = await this.getKeyPairFromDb();

    this.integrationGuid = await this.getIntegrationGuidFromDb();
    log.debug(this.keyPair);

    if (!this.keyPair || !this.integrationGuid) {
      await this.register();
    }

    log.debug("keys init", {
      public: await this.getPublicKeyStr(),
      guid: this.integrationGuid,
    });
  }

  public async getQrCodeUrl(
    doc: AvmIntegrationDocument,
    enableIntegration = false
  ) {
    if (!this.integrationGuid) {
      throw new Error("Integration guid missing");
    }

    if (!doc.guid || !doc.encryptionKey) {
      log.debug(doc);
      throw new Error("Document guid or key missing");
    }

    let integrationObj = {};
    if (enableIntegration) {
      const integration = await this.getIntegrationBearerToken(true);
      log.debug("Integration JWT", integration);
      integrationObj = { integration: integration };
    }

    return this.apiClient.qrCodeUrl({
      guid: doc.guid,
      key: doc.encryptionKey,
      ...integrationObj,
    });
  }

  private async register() {
    if (this.keyPair && this.integrationGuid) {
      throw new Error("Already registered.");
    }

    await this.generateKeys();

    const publicKey = await this.getPublicKeyStr();

    log.info("Registering integration", publicKey);

    const res = await this.apiClient.registerIntegration({
      platform: "extension",
      displayName: "Autogram Extension",
      publicKey:
        "-----BEGIN PUBLIC KEY-----\n" +
        publicKey +
        "\n-----END PUBLIC KEY-----",
    });

    this.integrationGuid = res.guid;
    await this.saveIntegrationGuid(res.guid);

    log.info("Integration registered", res);
  }

  public async addDocument(
    document: DocumentToSign
  ): Promise<AvmIntegrationDocument> {
    // TODO zatial funguje iba pre jeden dokument
    const encryptionKey = await this.initDocumentKey();
    log.debug("Sending document", document);
    const res = await this.apiClient.postDocuments(
      document,
      await this.getIntegrationBearerToken(),
      encryptionKey
    );
    return {
      guid: res.guid,
      encryptionKey: encryptionKey,
      lastModified: res.lastModified,
    };
  }

  public async waitForSignature(
    documentRef: AvmIntegrationDocument,
    abortController: AbortController
  ): Promise<SignedDocument> {
    if (
      !documentRef.guid ||
      !documentRef.encryptionKey ||
      !documentRef.lastModified
    ) {
      log.debug(documentRef);
      throw new Error("Document guid, key or last-modified missing");
    }

    this.apiClient.signRequest(
      {
        documentGuid: documentRef.guid,
        documentEncryptionKey: documentRef.encryptionKey,
      },
      await this.getIntegrationBearerToken()
    );

    while (!abortController.signal.aborted) {
      const documentResult = await this.apiClient.getDocument(
        { guid: documentRef.guid },
        documentRef.encryptionKey,
        documentRef.lastModified
      );
      log.debug(documentResult);
      if (documentResult.status === "signed") {
        return documentResult.document;
      } else if (documentResult.status === "pending") {
        // wait
      }
      await wait(1000);
    }
    throw new Error("Aborted");
  }

  // private methods

  private async loadSubtleCrypto() {
    // We are doing this because of testing in jest jsdom
    if (!this._subtleCrypto) {
      const browserSubtle = globalThis.crypto.subtle;
      if (browserSubtle) {
        this._subtleCrypto = browserSubtle;
        return;
      }

      try {
        const crypto = await import("crypto");
        // @ts-expect-error crypto
        this._subtleCrypto = crypto.webcrypto.subtle;
        return;
      } catch (e) {
        throw new Error("SubtleCrypto not available");
      }
    }
  }

  private async getIntegrationBearerToken(withDevice = false) {
    if (!this.keyPair) {
      throw new Error("Key pair missing");
    }
    if (!this.integrationGuid) {
      throw new Error("Integration guid missing");
    }
    let jwt = new SignJWT({
      // aud: "device",
      // sub: this.integrationGuid,
      // exp: Math.floor(Date.now() / 1000) + 60,
    })
      .setProtectedHeader({ alg: "ES256" })
      .setJti(randomUUID())
      .setSubject(this.integrationGuid);

    if (withDevice) {
      jwt = jwt.setAudience("device");
    }

    jwt = jwt.setExpirationTime("5min");
    return jwt.sign(this.keyPair.privateKey);
  }

  private exportRawBase64(key: CryptoKey): Promise<string> {
    return this.subtleCrypto.exportKey("raw", key).then(arrayBufferToBase64);
  }

  private async generateKeys() {
    log.info("Generating keys");
    // ES256
    const keyPair = await this.subtleCrypto.generateKey(
      {
        name: "ECDSA",
        namedCurve: "P-256",
      },
      true,
      ["sign", "verify"]
    );
    log.debug("Key pair generated", keyPair);
    await this.saveKeyPair(keyPair);
    this.keyPair = keyPair;
    log.debug("Keys generated", this.keyPair);
  }

  private async saveKeyPair(keyPair: CryptoKeyPair) {
    return this.db.set("keyPair", keyPair); // TODO: toto je zle, lebo zapisujeme v kontexte webu, nie rozsirenia
  }

  private async getKeyPairFromDb(): Promise<CryptoKeyPair | null> {
    return this.db.get("keyPair").then((keyPair) => {
      if (keyPair) {
        return keyPair;
      }
      return null;
    });
  }

  private async saveIntegrationGuid(guid: string) {
    return this.db.set("integrationGuid", guid);
  }

  private async getIntegrationGuidFromDb(): Promise<string | null> {
    return this.db.get("integrationGuid").then((guid) => {
      if (guid) {
        return guid;
      }
      return null;
    });
  }

  private async getPublicKeyStr() {
    if (!this.keyPair) {
      throw new Error("Key pair missing");
    }
    return this.subtleCrypto
      .exportKey("spki", this.keyPair.publicKey)
      .then(arrayBufferToBase64);
  }

  private async initDocumentKey() {
    const documentKey = await this.subtleCrypto.generateKey(
      {
        name: "AES-GCM",
        length: 256,
      },
      true,
      ["encrypt", "decrypt"]
    );
    return await this.exportRawBase64(documentKey);
  }
}

export interface AutogramVMobileIntegrationInterface {
  loadOrRegister(): Promise<void>;
  getQrCodeUrl(doc: AvmIntegrationDocument): Promise<string>;
  addDocument(documentToSign: DocumentToSign): Promise<AvmIntegrationDocument>;
  waitForSignature(
    doc: AvmIntegrationDocument,
    abortController?: AbortController
  ): Promise<SignedDocument>;
}

export interface AutogramVMobileIntegrationInterfaceStateful {
  init(): Promise<void>;
  loadOrRegister(): Promise<void>;
  getQrCodeUrl(): Promise<string>;
  addDocument(documentToSign: DocumentToSign): Promise<void>;
  waitForSignature(abortController?: AbortController): Promise<SignedDocument>;
  reset(): Promise<void>;
}

/**
 * Client for the Autogram v mobile server API
 */
export class AutogramVMobileIntegrationApiClient {
  baseUrl: string;
  constructor() {
    this.baseUrl = "https://autogram.slovensko.digital/api/v1";
  }

  _registerIntegration = "/integrations" as const;
  registerIntegration(
    data: NonNullable<
      paths[typeof this._registerIntegration]["post"]["requestBody"]
    >["content"]["application/json"]
  ): Promise<z.infer<typeof PostIntegrationResponse>> {
    const requestBody = JSON.stringify(data);
    const url = this.baseUrl + this._registerIntegration;
    log.debug("Registering integration", { url, requestBody });
    return (
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: requestBody,
      })
        .then(async (res) => {
          const text = await res.text();
          log.debug("Integration registration response", {
            text,
            status: res.status,
            statusText: res.statusText,
          });
          return JSON.parse(text);
        })
        // .then((res) => res.json())
        .catch((err) => {
          log.error("Integration registration failed", err);
          throw err;
        })
        .then((res) => PostIntegrationResponse.parse(res))
    );
  }

  _getIntegrationDevices = "/integration-devices" as const;
  getIntegrationDevices() {
    return fetch(this.baseUrl + this._getIntegrationDevices, {
      method: "GET",
    }).then((res) => GetIntegrationDevicesResponseBody.parse(res.json()));
  }

  _documents = "/documents" as const;
  async postDocuments(
    data: NonNullable<
      paths[typeof this._documents]["post"]["requestBody"]
    >["content"]["application/json"],
    bearerToken: string,
    documentEncryptionKey: string
  ) {
    if (!documentEncryptionKey) {
      throw new Error("Document encryption key missing");
    }
    if (!bearerToken) {
      throw new Error("Bearer token missing");
    }
    const res = await fetch(this.baseUrl + this._documents, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + bearerToken,
        "X-Encryption-Key": documentEncryptionKey,
      },
      body: JSON.stringify(data),
    });

    if (res.status !== 200) {
      log.error("API Error", res.status, res.statusText);
      const json = await res.json();
      throw new Error(JSON.stringify(ApiErrorResponse.parse(json)));
    }
    const json = await res.json();
    return {
      ...PostDocumentsResponse.parse(json),
      lastModified: res.headers.get("Last-Modified"),
    };
  }

  _getDocument = "/documents/{guid}" as const;
  async getDocument(
    params: paths[typeof this._getDocument]["get"]["parameters"]["path"],
    documentEncryptionKey: string,
    documentLastModified?: string
  ): Promise<GetDocumentResult> {
    if (!documentEncryptionKey) {
      throw new Error("Document encryption key missing");
    }
    const res = await fetch(
      this.baseUrl + this._getDocument.replace("{guid}", params.guid),
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Encryption-Key": documentEncryptionKey,
          ...(documentLastModified
            ? { "If-Modified-Since": documentLastModified }
            : null),
        },
      }
    );
    if (res.status == 304) {
      return { status: "pending" };
    }
    if (res.status != 200) {
      const error = ApiErrorResponse.parse(await res.json());
      log.error("API Error", error);
      throw new Error(JSON.stringify(error));
    }

    const resJson = await res.json();
    return {
      status: "signed",
      document: GetDocumentsResponse.parse(resJson),
    };
  }

  _signRequest = "/sign-request" as const;
  signRequest(
    data: NonNullable<
      paths[typeof this._signRequest]["post"]["requestBody"]
    >["content"]["application/json"],
    bearerToken: string
  ) {
    return fetch(this.baseUrl + this._signRequest, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearerToken}`,
      },
      body: JSON.stringify(data),
    }).then((res) => res.json());
  }

  _getQrCodeUrl = "/qr-code" as const;
  qrCodeUrl(
    data: paths[typeof this._getQrCodeUrl]["get"]["parameters"]["query"]
  ) {
    return (
      this.baseUrl +
      this._getQrCodeUrl +
      "?" +
      new URLSearchParams(data).toString()
    );
  }
}

// Zod Types

export const PostIntegrationResponse = z.object({
  guid: z.string(),
});

export const GetIntegrationDevicesResponseBody = z.array(
  z.object({
    deviceId: z.string(),
    platform: z.string(),
    displayName: z.string(),
  })
);

export const PostDocumentsResponse = z.object({
  guid: z.string(),
});

export const ApiErrorResponse = z.object({
  code: z.string(),
  message: z.string(),
  details: z.string().optional(),
});

export const GetDocumentsResponse = z.object({
  filename: z.string(),
  mimeType: z.string(),
  content: z.string(),
  signers: z
    .array(
      z.object({
        signedBy: z.string().optional(),
        issuedBy: z.string().optional(),
      })
    )
    .optional(),
});

// Types

/**
 * Interface for a key-value store used for persisting integration's state
 */
export interface DBInterface {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set: (key: IDBValidKey, value: any) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get<T = any>(key: IDBValidKey): Promise<T | undefined>;
}

export type DocumentToSign = NonNullable<
  paths["/documents"]["post"]["requestBody"]
>["content"]["application/json"];

export type SignedDocument = z.infer<typeof GetDocumentsResponse>;
type GetDocumentResult =
  | {
      status: "pending";
    }
  | {
      status: "signed";
      document: SignedDocument;
    };

// Helper functions

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Base64.fromUint8Array(new Uint8Array(buffer));
  // return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)));
}

export function randomUUID() {
  return globalThis.crypto.randomUUID();
}

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
