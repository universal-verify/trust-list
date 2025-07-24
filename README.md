# Trust List

A JSON list of digital credential issuers trusted by Universal Verify

## Files

- `trust-list.json` - The main trust list containing trusted issuers and their certificates
- `trust-list.schema.json` - JSON Schema defining the structure and validation rules
- `scripts/validate-trust-list.js` - Validation script for checking trust list schema integrity
- `scripts/check-certificate-expirations.js` - Script for checking certificate expiration dates
- `scripts/pem-to-entry.js` - Utility for extracting issuer IDs from X.509 certificates
- `TRUST_POLICY.md` - Criteria and governance for issuer inclusion in the trust list

## Trusted Issuers

The following government entities are currently included in our trust list, all of which support Certificate Revocation List (CRL) functionality and are recommended by Apple for use with Wallet and Apple's Verify with Wallet feature:

### United States
- Arizona Department of Transportation
- California Department of Motor Vehicles
- Colorado Department of Revenue
- Georgia Department of Driver Services
- Hawaii Department of Transportation
- Maryland MVA
- New Mexico Taxation and Revenue Department
- Ohio Department of Public Safety
- PR Department of Transportation and Public Works

### International
- Japan Agency for Local Authority Information Systems

For detailed information about our selection criteria and governance process, see [TRUST_POLICY.md](TRUST_POLICY.md).

## Validation

The project includes automatic validation to ensure `trust-list.json` conforms to the schema:

### Manual Validation

Run the validation scripts directly:

```bash
# Validate trust list schema
node scripts/validate-trust-list.js

# Check certificate expirations
node scripts/check-certificate-expirations.js
```

### Pre-commit Hook

A Git pre-commit hook automatically validates the schema of `trust-list.json` before each commit. If validation fails, the commit is blocked.

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
