# Autogram SDK - use Autogram signer from web

## Installation

```bash
npm install autogram-sdk
```

## Usage

```typescript
import { FullClient } from ".";

const client = new FullClient();

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
