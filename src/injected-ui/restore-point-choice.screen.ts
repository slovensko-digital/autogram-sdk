import { html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { closeSvg } from "./svg";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { AutogramBaseScreen } from "./base.screen";
import { EventRestorePointResult } from "./events";

@customElement("autogram-restore-point-choice-screen")
export class AutogramRestorePointChoiceScreen extends AutogramBaseScreen {
  render() {
    return html`
      <div class="heading">
        <h1>Obnoviť?</h1>
        <button class="close" @click="${this.close}">
          ${unsafeSVG(closeSvg)}
        </button>
      </div>
      <div class="main">
        <p>
          Zdá sa, že tento dokument ste už podpísali cez Autogram v Mobile. Chcete
          použiť už podpísaný dokument?
        </p>
        <div class="choice-screen">
          <button class="tile" @click="${this.chooseUseRestorePoint(true)}">
            <h2>Áno, pokračovať</h2>
            <div>
              Použijeme už podpísaný dokument z <b>Autogram v Mobile</b>.
            </div>
          </button>

          <button class="tile" @click="${this.chooseUseRestorePoint(false)}">
            <h2>Nie, začať odznova</h2>
            <div>Chcem podpísať dokument znovu.</div>
          </button>
        </div>
      </div>
    `;
  }

  chooseUseRestorePoint(use: boolean) {
    return () => this.dispatchEvent(new EventRestorePointResult(use));
  }
}
