import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function checkCertificateExpiration(certificatePem) {
    try {
        // Create a temporary file with the certificate
        const tempFile = path.join(process.cwd(), 'temp_cert_validation.pem');
        fs.writeFileSync(tempFile, certificatePem);
        
        // Use OpenSSL to get certificate expiration date
        const opensslOutput = execSync(`openssl x509 -in "${tempFile}" -noout -dates`, { encoding: 'utf8' });
        
        // Clean up temp file
        fs.unlinkSync(tempFile);
        
        // Parse the notAfter date
        const notAfterMatch = opensslOutput.match(/notAfter=([^\n]+)/);
        if (!notAfterMatch) {
            throw new Error('Could not parse certificate expiration date');
        }
        
        const expirationDate = new Date(notAfterMatch[1]);
        const now = new Date();
        const oneMonthFromNow = new Date();
        oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
        
        return {
            expirationDate,
            isExpired: expirationDate < now,
            expiresWithinMonth: expirationDate < oneMonthFromNow && expirationDate > now,
            daysUntilExpiration: Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24))
        };
    } catch (error) {
        throw new Error(`Failed to check certificate expiration: ${error.message}`);
    }
}

function checkCertificateExpirations(trustList) {
    const warnings = [];
    const expired = [];
    
    trustList.forEach((issuer, issuerIndex) => {
        if (issuer.certificates) {
            issuer.certificates.forEach((cert, certIndex) => {
                if(cert.allowExpired) return;
                try {
                    const expirationInfo = checkCertificateExpiration(cert.data);
                    
                    if (expirationInfo.isExpired) {
                        expired.push(`Issuer ${issuerIndex + 1} (${issuer.name}): Certificate ${certIndex + 1} expired on ${expirationInfo.expirationDate.toISOString().split('T')[0]}`);
                    } else if (expirationInfo.expiresWithinMonth) {
                        warnings.push(`Issuer ${issuerIndex + 1} (${issuer.name}): Certificate ${certIndex + 1} expires in ${expirationInfo.daysUntilExpiration} days on ${expirationInfo.expirationDate.toISOString().split('T')[0]}`);
                    }
                } catch (error) {
                    console.error('Error checking certificate expiration:');
                    console.error(error);
                    process.exit(1);
                }
            });
        }
    });
    
    return { warnings, expired };
}

function main() {
    const trustListPath = path.join(process.cwd(), 'trust-list.json');
    
    try {
        // Read the trust list
        const trustListContent = fs.readFileSync(trustListPath, 'utf8');
        const trustList = JSON.parse(trustListContent);
        
        // Check certificate expirations
        const { warnings, expired } = checkCertificateExpirations(trustList);
        
        // Display warnings
        if (warnings.length > 0) {
            console.warn('⚠️  Certificate expirations upcoming soon:');
            warnings.forEach(warning => {
                console.warn(`  - ${warning}`);
            });
        }
        
        // Display expired certificates
        if (expired.length > 0) {
            console.error('❌ Certificate expirations:');
            expired.forEach(error => {
                console.error(`  - ${error}`);
            });
        }
        
        if (warnings.length > 0) {
            console.log(`⚠️  ${warnings.length} certificate(s) expiring soon - please review`);
        }
        if (expired.length > 0) {
            console.log(`❌  ${expired.length} certificate(s) expired - please review`);
        }

        if(expired.length == 0 && warnings.length == 0) {
            console.log('✅ No expired or expiring certificates found');
        }
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error checking certificate expirations:', error.message);
        process.exit(1);
    }
}

// Run the main function if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
} 