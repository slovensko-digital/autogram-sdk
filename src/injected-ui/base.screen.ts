import { LitElement, html, css } from "lit";

import { closeSvg } from "./svg";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { EVENT_CLOSE } from "./events";

export class AutogramBaseScreen extends LitElement {
  static styles = css`
    .heading {
      /* Website/Headline 2 */
      /* 01 Header */

      box-sizing: border-box;

      /* Auto layout */
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      padding: 30px 30px 20px;
      gap: 20px;

      /* Inside auto layout */
      flex: none;
      order: 0;
      align-self: stretch;
      flex-grow: 0;
    }

    .heading > h1 {
      font-weight: 900;
      font-size: 36px;
      line-height: 45px;

      /* Neutral/Black */
      color: #000000;
    }
    .close {
      box-sizing: border-box;
      background: none;
      border: none;
      cursor: pointer;
    }

    .choice-screen {
      display: flex;
      flex-direction: row;
      gap: 20px;
      padding: 0 30px 30px;
    }

    .choice-screen .tile {
      flex: 1 1;
      display: flex;
      flex-direction: column;
      gap: 10px;

      box-sizing: border-box;

      align-items: flex-start;
      padding: 20px;

      /* Neutrálna paleta/Biela */
      background: #ffffff;
      /* Neutrálna paleta/N300 */
      border: 1px solid #e0e0e0;
      border-radius: 10px;

      text-align: left;

      font-family: "Source Sans 3", sans-serif;
      font-size: 19px;
      font-weight: 400;
      line-height: 28px;

      cursor: pointer;
    }

    .choice-screen .tile h2 {
      /* Web - desktop/Link L bold */
      font-weight: 700;
      font-size: 24px;
      line-height: 36px;
      /* identical to box height, or 150% */
      letter-spacing: 0.5px;
      text-decoration-line: underline;

      /* Farby textov/Primárny text */
      color: #126dff;

      /* Inside auto layout */
      flex: none;
      order: 0;
      align-self: stretch;
      flex-grow: 0;
    }

    .cols {
      display: flex;
      flex-direction: row;
      gap: 20px;
      padding: 0 30px 30px;
    }

    .main {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      width: 100%;
    }
  `;
  render() {
    return html`
      <div class="heading">
        <h1>?</h1>
        <button class="close" @click="${this.close}">
          ${unsafeSVG(closeSvg)}
        </button>
      </div>
      <div class="main">
        <div class="screen"></div>
      </div>
    `;
  }

  close() {
    this.dispatchEvent(
      new CustomEvent(EVENT_CLOSE, { bubbles: true, composed: true })
    );
  }
}
