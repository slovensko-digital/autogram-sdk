export {
  apiClient as desktopApiClient,
  SignatureParameters as DesktopSignatureParameters,
  AutogramDocument as DesktopAutogramDocument,
  SignResponseBody as DesktopSignResponseBody,
} from "./autogram-api/index";
export { UserCancelledSigningException as DesktopUserCancelledSigningException } from "./autogram-api/lib/apiClient";
export {
  AutogramVMobileIntegration,
  AutogramVMobileIntegrationInterfaceStateful,
  randomUUID,
  SignedDocument as AVMSignedDocument,
  GetDocumentsResponse as AVMGetDocumentsResponse,
  DocumentToSign as AVMDocumentToSign,
  AvmIntegrationDocument as AVMIntegrationDocument,
} from "./avm-api/lib/apiClient";

export { AutogramVMobileSimulation } from "./avm-api/lib/apiClient-mobile";
