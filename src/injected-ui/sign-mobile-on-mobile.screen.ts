import { html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { closeSvg } from "./svg";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { AutogramBaseScreen } from "./base.screen";

@customElement("autogram-signing-mobile-on-mobile-screen")
export class AutogramSigningMobileOnMobileScreen extends AutogramBaseScreen {
  @property()
  url: string;

  render() {
    return html`
      <div class="heading">
        <h1>Podpisujeme v mobilnom Autograme</h1>
        <button class="close" @click="${this.close}">
          ${unsafeSVG(closeSvg)}
        </button>
      </div>
      <div class="main">
        <p>Podpisovanie by malo bezat same.</p>
        <p>
          Ak nie,
          <a href="${this.url}" target="_blank" rel="noopener"
            >kliknite sem pre opatovny pokus</a
          >.
        </p>
      </div>
    `;
  }
}
