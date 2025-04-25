export class UserCancelledSigningException extends Error {
  constructor() {
    super("User cancelled signing");
    this.name = "UserCancelledSigningException";
  }
}