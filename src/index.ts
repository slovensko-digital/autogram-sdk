/**
 * @module autogram-index
 */

/* Autogram Desktop */
export {
  apiClient as desktopApiClient,
  SignatureParameters as DesktopSignatureParameters,
  AutogramDocument as DesktopAutogramDocument,
  SignResponseBody as DesktopSignResponseBody,
} from "./autogram-api/index";
export { UserCancelledSigningException as DesktopUserCancelledSigningException } from "./autogram-api/lib/apiClient";

/* Autogram V Mobile */
export {
  AutogramVMobileIntegration,
  AutogramVMobileIntegrationInterfaceStateful,
  randomUUID,
  SignedDocument as AVMSignedDocument,
  GetDocumentsResponse as AVMGetDocumentsResponse,
  DocumentToSign as AVMDocumentToSign,
  AvmIntegrationDocument as AVMIntegrationDocument,
} from "./avm-api/index";
export { AutogramVMobileSimulation } from "./avm-api/index";
