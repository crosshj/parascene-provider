// Load environment variables from .env file
import 'dotenv/config';

// Bridge ESM tests to global jest helper so we don't need explicit imports
import { jest as jestGlobals } from '@jest/globals';
globalThis.jest = jestGlobals;
