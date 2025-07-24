import fs from 'fs';
import path from 'path';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

// Initialize Ajv validator with JSON Schema draft 2020-12 support
const ajv = new Ajv({
    allErrors: true,
    verbose: true
});

// Add format validators
addFormats(ajv);

function validateTrustList(data, schema) {
    // Compile the schema
    const validate = ajv.compile(schema);
    
    // Validate the data
    const isValid = validate(data);
    
    if (!isValid) {
        return validate.errors.map(error => {
            const path = error.instancePath || '/';
            return `${path}: ${error.message}`;
        });
    }
    
    return [];
}

function main() {
    const trustListPath = path.join(process.cwd(), 'trust-list.json');
    const schemaPath = path.join(process.cwd(), 'trust-list.schema.json');
    
    try {
        // Read the trust list
        const trustListContent = fs.readFileSync(trustListPath, 'utf8');
        const trustList = JSON.parse(trustListContent);
        
        // Read the schema
        const schemaContent = fs.readFileSync(schemaPath, 'utf8');
        const schema = JSON.parse(schemaContent);
        
        // Validate the trust list using the schema
        const errors = validateTrustList(trustList, schema);
        
        if (errors.length > 0) {
            console.error('❌ Trust list validation failed:');
            errors.forEach(error => {
                console.error(`  - ${error}`);
            });
            process.exit(1);
        }
        
        console.log('✅ Trust list validation passed');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error validating trust list:', error.message);
        process.exit(1);
    }
}

// Run the main function if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
} 