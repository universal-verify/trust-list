# Trust Policy for Issuer Inclusion

## Purpose

This document outlines the criteria and evaluation process used to determine whether a digital credential issuer may be included as an entity in our trust list. The intent is to provide assurance to users of this list that issuers are carefully selected and meet a baseline standard of functional capabilities.

## Criteria for Inclusion

### Primary Selection Criteria

1. **Apple Recommendations**: We primarily include issuers that are recommended by [Apple](https://developer.apple.com/wallet/get-started-with-verify-with-wallet/) for use with Apple's Verify with Wallet feature. These recommendations are based on Apple's evaluation of issuer capabilities and security practices.

2. **Certificate Revocation List (CRL) Support**: All included issuers must support Certificate Revocation List (CRL) functionality. This ensures that revoked certificates can be identified and excluded from trust, maintaining the security and integrity of the trust list.

3. **Government or Recognized Authority**: Issuers should be government entities or other recognized authorities with the legal mandate to issue digital credentials.

## Criteria for Removal

- Evidence of security compromise
- Changes in issuer's legal authority or mandate
- Failure to maintain CRL functionality

## Governance and Oversight

### Review Process

- Review of Apple's updated recommendations
- Review of certificate validity and expiration dates
- Validation of CRL endpoints

_GitHub Actions will be used to automatically create an issue every month to start the review process_

### Decision Making

- Decisions are subject to community review and may be revisited as time goes on
- We encourage stakeholders, especially financial institutions and relying parties, to submit feedback or concerns via GitHub Issues

## Disclaimers and Limitations

### Scope Limitations

- Inclusion does not constitute endorsement of the issuer beyond their technical capabilities
- The list may not be comprehensive of all qualified issuers

### Technical Limitations

- Digital Credential validation using this Trust list depends on the accuracy of issuer CRL information

### Legal Disclaimers

- This trust list is provided "as is" without warranties
- Users are responsible for their own security assessments
- The maintainers are not liable for any damages arising from use of this list