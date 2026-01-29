# Plannify PDF Service

This service is responsible for generating a variety of PDF documents for the Plannify application, including workday reports and other related documents.

It exists as a standalone microservice within the Plannify ecosystem because I didn't found any existing Rust libraries that could handle PDF generation as I wanted.

## gRPC

### Generating code from proto files

```bash
pnpm run proto:generate
```
