import { css, html } from "lit";
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
        <h1>AVM</h1>
        <button class="close" @click="${this.close}">
          ${unsafeSVG(closeSvg)}
        </button>
      </div>
      <div class="main">
        <div class="col">
          <p style="text-align: center;">
            Podpisovanie by malo bežať samo. Ak sa aplikácia Autogram v obile
            neotvorila automaticky, použite tlačidlo nižšie.
          </p>
        </div>
        <div class="col">
          <div style="text-align: center;">
            <a href="${this.url}" target="_blank" rel="noopener" class="button"
              >Otvoriť Autogram v mobile</a
            >
          </div>
        </div>
      </div>
    `;
  }
}
