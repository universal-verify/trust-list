import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function hexToUrlSafeBase64(hexString) {
    // Remove colons and convert to byte array
    const hex = hexString.replace(/:/g, '');
    const bytes = new Uint8Array(hex.length / 2);

    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }

    // Convert to standard Base64
    const base64 = Buffer.from(bytes).toString('base64');

    // Make it URL-safe
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function extractCertificateInfo(pemFilePath, shouldPrintCert = false) {
    try {
        // Determine file format
        const fileExtension = pemFilePath.toLowerCase().split('.').pop();
        
        // Determine OpenSSL command based on file format
        let opensslCommand;
        if (fileExtension === 'pem') {
            opensslCommand = `openssl x509 -in "${pemFilePath}" -noout -text`;
        } else if (fileExtension === 'cer' || fileExtension === 'crt') {
            // Try PEM format first, then DER
            try {
                opensslCommand = `openssl x509 -in "${pemFilePath}" -noout -text`;
                execSync(opensslCommand, { encoding: 'utf8' });
            } catch (error) {
                opensslCommand = `openssl x509 -inform DER -in "${pemFilePath}" -noout -text`;
            }
        } else {
            opensslCommand = `openssl x509 -in "${pemFilePath}" -noout -text`;
        }
        
        // Use OpenSSL to extract certificate information
        const opensslOutput = execSync(opensslCommand, { encoding: 'utf8' });

        if(shouldPrintCert) console.log(opensslOutput);
        
        // Find the Subject Key Identifier
        const skiMatch = opensslOutput.match(/X509v3 Subject Key Identifier:\s*\n\s*([A-F0-9:]+)/i);
        if (!skiMatch) {
            throw new Error('Subject Key Identifier not found in certificate');
        }
        const skiValue = skiMatch[1].trim();
        
        // Find the Subject information
        const subjectMatch = opensslOutput.match(/Subject: ([^\n]+)/);
        if (!subjectMatch) {
            throw new Error('Subject information not found in certificate');
        }
        
        // Parse subject components
        const subject = subjectMatch[1];
        const subjectParts = {};
        
        // Extract common fields from subject
        const cMatch = subject.match(/C=([^,\/]+)/);
        if (cMatch) subjectParts.country = cMatch[1];
        
        const oMatch = subject.match(/O=([^,\/]+)/);
        if (oMatch) subjectParts.organization = oMatch[1];
        
        const cnMatch = subject.match(/CN=([^,\/]+)/);
        if (cnMatch) subjectParts.commonName = cnMatch[1];
        
        // Read certificate content based on file format
        let certificateContent;
        
        if (fileExtension === 'pem') {
            // PEM files are text-based
            certificateContent = fs.readFileSync(pemFilePath, 'utf8');
        } else if (fileExtension === 'cer' || fileExtension === 'crt') {
            // CER/CRT files can be binary or text-based
            // First try to read as text (PEM format)
            try {
                certificateContent = fs.readFileSync(pemFilePath, 'utf8');
                // Check if it's actually PEM format
                if (!certificateContent.includes('-----BEGIN CERTIFICATE-----')) {
                    throw new Error('Not PEM format');
                }
            } catch (error) {
                // If text reading fails, try binary format
                try {
                    // Convert binary DER to PEM format using OpenSSL
                    const pemOutput = execSync(`openssl x509 -inform DER -in "${pemFilePath}" -outform PEM`, { encoding: 'utf8' });
                    certificateContent = pemOutput;
                } catch (binaryError) {
                    throw new Error(`Failed to read certificate file. Tried both PEM and DER formats. Error: ${binaryError.message}`);
                }
            }
        } else {
            // Unknown format, try to detect
            try {
                certificateContent = fs.readFileSync(pemFilePath, 'utf8');
                if (!certificateContent.includes('-----BEGIN CERTIFICATE-----')) {
                    throw new Error('Not PEM format');
                }
            } catch (error) {
                throw new Error(`Unsupported certificate format. Please use .pem, .cer, or .crt files.`);
            }
        }
        
        return {
            ski: skiValue,
            subject: subjectParts,
            pemContent: certificateContent
        };
    } catch (error) {
        throw new Error(`Failed to extract certificate information: ${error.message}`);
    }
}

function createTrustListEntry(certInfo) {
    // Convert SKI to URL-safe base64
    const urlSafeBase64 = hexToUrlSafeBase64(certInfo.ski);
    
    // Clean up the PEM content (normalize line endings)
    const cleanPemContent = certInfo.pemContent.replace(/\r\n/g, '\n').replace(/\n$/, '');

    // Create the trust list entry
    const entry = {
        "issuer_id": `x509_aki:${urlSafeBase64}`,
        "entity_type": "government",
        "name": certInfo.subject.organization || certInfo.subject.commonName || "",
        "certificates": [
            {
                "certificate": cleanPemContent,
                "certificate_format": "pem",
                "source": ""
            }
        ]
    };
    
    return entry;
}

function addEntryToTrustList(entry) {
    const trustListPath = path.join(process.cwd(), 'trust-list.json');
    
    try {
        // Read existing trust list
        const trustListContent = fs.readFileSync(trustListPath, 'utf8');
        const trustList = JSON.parse(trustListContent);
        
        // Check if entry already exists
        const existingIndex = trustList.findIndex(item => item.issuer_id === entry.issuer_id);
        
        if (existingIndex !== -1) {
            // Merge certificates intelligently
            const existingEntry = trustList[existingIndex];
            const newCert = entry.certificates[0];
            
            let certificateExists = false;
            let certificateUpdated = false;
            
            // Check existing certificates for matches
            existingEntry.certificates.forEach((existingCert, index) => {
                // Check if certificates are identical
                if (existingCert.certificate == newCert.certificate) {
                    certificateExists = true;
                } else {
                    // Check if they have the same subject key identifier (different cert, same issuer)
                    try {
                        const existingSki = extractSubjectKeyIdentifierFromCert(existingCert.certificate);
                        const newSki = extractSubjectKeyIdentifierFromCert(newCert.certificate);
                        
                        if (existingSki === newSki) {
                            existingEntry.certificates[index].certificate = newCert.certificate;
                            certificateExists = true;
                            certificateUpdated = true;
                        }
                    } catch (error) {
                        // If we can't extract SKI, just compare certificate strings
                        console.log(`   Could not extract SKI, comparing certificate strings only`);
                        throw error;
                    }
                }
            });
            
            // If certificate doesn't exist, add it
            if (!certificateExists) {
                existingEntry.certificates.push(newCert);
            }
            
            // Update basic fields that might have changed
            existingEntry.name = entry.name;
            
            // Write back to file
            fs.writeFileSync(trustListPath, customJSONStringify(trustList) + '\n');
            if (certificateUpdated) {
                console.log(`✅ Certificate updated for entry in trust-list.json`);
            } else if(certificateExists) {
                console.log(`✅ Certificate already exists for entry in trust-list.json`);
            } else {
                console.log(`✅ Certificate added to entry in trust-list.json`);
            }
        } else {
            // Add new entry
            trustList.push(entry);

            // Write back to file
            fs.writeFileSync(trustListPath, customJSONStringify(trustList) + '\n');
            console.log(`✅ Entry added to trust-list.json`);
        }
        
    } catch (error) {
        throw new Error(`Failed to add entry to trust list: ${error.message}`);
    }
}

function extractSubjectKeyIdentifierFromCert(certificatePem) {
    try {
        // Create a temporary file with the certificate
        const tempFile = path.join(process.cwd(), 'temp_cert.pem');
        fs.writeFileSync(tempFile, certificatePem);
        
        // Use OpenSSL to extract the subject key identifier
        const opensslOutput = execSync(`openssl x509 -in "${tempFile}" -noout -text`, { encoding: 'utf8' });
        
        // Find the Subject Key Identifier line
        const skiMatch = opensslOutput.match(/X509v3 Subject Key Identifier:\s*\n\s*([A-F0-9:]+)/i);
        
        // Clean up temp file
        fs.unlinkSync(tempFile);
        
        if (!skiMatch) {
            throw new Error('Subject Key Identifier not found in certificate');
        }
        
        return skiMatch[1].trim();
    } catch (error) {
        throw new Error(`Failed to extract SKI from certificate: ${error.message}`);
    }
}

function customJSONStringify(arr) {
    const json = JSON.stringify(arr, null, 2);
    return json.replace(/}\s*,\s*{/g, '}, {');
  }

function main() {
    // Check if a file path was provided
    if (process.argv.length < 3) {
        console.error('Usage: node pemToEntry.js <path-to-certificate.pem> [--add]');
        console.error('');
        console.error('Options:');
        console.error('  --add    Add the generated entry directly to trust-list.json');
        process.exit(1);
    }

    const pemFilePath = process.argv[2];
    const shouldAdd = process.argv.includes('--add');
    const shouldPrintCert = process.argv.includes('--print-cert');

    try {
        // Extract certificate information
        const certInfo = extractCertificateInfo(pemFilePath, shouldPrintCert);

        // Create trust list entry
        const entry = createTrustListEntry(certInfo);
        
        if (shouldAdd) {
            // Add to trust list file
            addEntryToTrustList(entry);
        } else {
            // Output the entry as JSON
            console.log(customJSONStringify(entry));
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

// Run the main function if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
  