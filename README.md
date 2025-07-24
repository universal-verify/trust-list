# Trust List

A JSON Schema-based list of digital credential issuers trusted by Universal Verify. This list is currently composed entirely of certificates recommended by [Apple](https://developer.apple.com/wallet/get-started-with-verify-with-wallet/)

## Files

- `trust-list.json` - The main trust list containing trusted issuers
- `trust-list.schema.json` - JSON Schema defining the structure and validation rules
- `scripts/validate-trust-list.js` - Validation script for checking trust list integrity
- `scripts/pem-to-entry.js` - Utility for extracting issuer IDs from X.509 certificates

## Validation

The project includes automatic validation to ensure `trust-list.json` conforms to the schema:

### Manual Validation

Run the validation script directly:

```bash
node scripts/validate-trust-list.js
```

### Pre-commit Hook

A Git pre-commit hook automatically validates `trust-list.json` before each commit. If validation fails, the commit is blocked.

The hook only runs when `trust-list.json` is modified, so it won't slow down commits that don't affect the trust list.

### Certificate Processing

To generate a trust list entry from an X.509 certificate:

```bash
# Generate entry JSON (output to console)
node scripts/pem-to-entry.js /path/to/certificate.pem

# Add entry directly to trust-list.json
node scripts/pem-to-entry.js /path/to/certificate.pem --add

# Print certificate details and generate entry JSON
node scripts/pem-to-entry.js /path/to/certificate.pem --print-cert

# Print certificate details and add entry directly to trust-list.json
node scripts/pem-to-entry.js /path/to/certificate.pem --add --print-cert
```

The script extracts:
- Subject Key Identifier and converts to URL-safe base64
- Certificate subject information (organization, common name, etc.)
- PEM certificate content
- Automatically creates a complete trust list entry template

The generated entry includes:
- `issuer_id` in x509_aki format
- `entity_type` set to "government"
- `name` from the certificate subject
- `certificates` array with the PEM certificate and source information

## Schema Requirements

Each trust list entry must include:

- `issuer_id` - Unique identifier for the issuer (DID or x509_aki format)
- `entity_type` - Type of entity (government, educational_institution, commercial, non_profit, international_body, federated_network, other)
- `name` - Official name for the entity

Additional requirements:
- X.509 AKI issuers (issuer_id starting with "x509_aki:") require: certificates array
- Each certificate must include: certificate (PEM format), certificate_format ("pem"), and source (non-empty string)
