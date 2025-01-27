# Autogram SDK - use Autogram signer from web

Autogram SDK is a TS/JS library that allows you to use the Autogram signer family (Autogram, Autogram V Mobile) from web. Not only does it provide an API to sign documents, but it also adds a UI for a consistent process of choosing the signer process (desktop/mobile).

UI is implemented using lit-element and lit-html, so it's lightweight and easy to customize and thanks to shadow DOM, it's encapsulated and it won't interfere with your styles.

## Installation

```bash
npm install autogram-sdk
```

## Usage

```typescript
import { CombinedClient } from ".";

const client = await CombinedClient.init();

const { content, issuedBy, signedBy } = await client.sign(
  {
    content: "hello world",
    filename: "hello.txt",
  },
  {
    level: "XAdES_BASELINE_B",
    container: "ASiC_E",
  },
  "text/plain",
  true
);
```

## Usage on web

```html
<script src="dist/index.global.js"></script>
<script>
  const client = await AutogramSDK.CombinedClient.init();

  const { content, issuedBy, signedBy } = await client.sign(
    {
      content: "hello world",
      filename: "hello.txt",
    },
    {
      level: "XAdES_BASELINE_B",
      container: "ASiC_E",
    },
    "text/plain",
    true
  );
</script>
```
