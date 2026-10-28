// Loaded with `node --import ./tests/setup.js` so these values are in place
// before src/config/env.js reads the environment.
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME_TEST || 'craveo_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-for-production';
