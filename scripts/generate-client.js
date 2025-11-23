import OpenAPI from 'openapi-typescript-codegen';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = path.resolve(__dirname, '../server/openapi.yaml');
const openApiSpec = yaml.load(fs.readFileSync(inputPath, 'utf8'));

OpenAPI.generate({
    input: openApiSpec,
    output: path.resolve(__dirname, '../src/client'),
    clientName: 'ApiClient',
    useOptions: true,
    useUnionTypes: true,
    exportCore: true,
    exportServices: true,
    exportModels: true,
    exportSchemas: true,
    indent: '4',
    postfixServices: 'Service',
    postfixModels: '',
    request: path.resolve(__dirname, '../src/client/core/request.ts')
})
    .then(() => {
        console.log('Client generated successfully!');
    })
    .catch((error) => {
        console.error('Error generating client:', error);
    });
