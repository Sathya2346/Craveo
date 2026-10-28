import assert from 'node:assert/strict';
import test, { after, before, beforeEach } from 'node:test';
import jwt from 'jsonwebtoken';
import { resetRateLimits } from '../src/middleware/rateLimit.js';
import { call, closePool, passwords, seedWorld } from './helpers.js';

let world;

before(async () => {
  world = await seedWorld();
});

after(async () => {
  await closePool();
});

beforeEach(() => resetRateLimits());

test('register rejects an invalid email and short password', async () => {
  const invalidEmail = await call('post', '/api/auth/register', {
    body: { name: 'Test User', email: 'not-an-email', password: 'secret123' },
  });
  assert.equal(invalidEmail.status, 400);
  assert.equal(invalidEmail.body.error.code, 'VALIDATION_ERROR');

  const shortPassword = await call('post', '/api/auth/register', {
    body: { name: 'Test User', email: 'valid@test.dev', password: '123' },
  });
  assert.equal(shortPassword.status, 400);
  assert.ok(shortPassword.body.error.details.some((detail) => detail.field === 'password'));
});

test('register rejects a duplicate email with 409', async () => {
  const response = await call('post', '/api/auth/register', {
    body: { name: 'Duplicate', email: 'customer@test.dev', password: 'secret123' },
  });
  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'CONFLICT');
});

test('register always creates a CUSTOMER even when a role is supplied', async () => {
  const response = await call('post', '/api/auth/register', {
    body: { name: 'Sneaky User', email: 'sneaky@test.dev', password: 'secret123', role: 'ADMIN' },
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.data.user.role, 'CUSTOMER');
  assert.ok(response.body.data.token);
});

test('login returns the same generic error for unknown email and wrong password', async () => {
  const wrongPassword = await call('post', '/api/auth/login', {
    body: { email: 'customer@test.dev', password: 'wrong-password' },
  });
  const unknownEmail = await call('post', '/api/auth/login', {
    body: { email: 'nobody@test.dev', password: 'whatever' },
  });

  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownEmail.status, 401);
  assert.equal(wrongPassword.body.error.message, unknownEmail.body.error.message);
  assert.equal(wrongPassword.body.error.message, 'Email or password is incorrect');
});

test('deactivated accounts cannot sign in or use an existing token', async () => {
  const login = await call('post', '/api/auth/login', {
    body: { email: 'inactive@test.dev', password: passwords.customer },
  });
  assert.equal(login.status, 401);

  const me = await call('get', '/api/auth/me', { token: world.tokens.inactive });
  assert.equal(me.status, 403);
  assert.equal(me.body.error.code, 'FORBIDDEN');
});

test('protected routes reject missing, malformed and forged tokens', async () => {
  const noToken = await call('get', '/api/auth/me');
  assert.equal(noToken.status, 401);

  const garbage = await call('get', '/api/auth/me', { token: 'not-a-jwt' });
  assert.equal(garbage.status, 401);

  const forged = jwt.sign({ sub: String(world.userIds.admin), role: 'ADMIN' }, 'a-different-secret');
  const forgedResponse = await call('get', '/api/auth/me', { token: forged });
  assert.equal(forgedResponse.status, 401);
});

test('me returns the profile plus activity counts', async () => {
  const response = await call('get', '/api/auth/me', { token: world.tokens.customer });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.user.email, 'customer@test.dev');
  assert.equal(response.body.data.stats.orders, 0);
  assert.equal(response.body.data.stats.addresses, 1);
  assert.ok(!('passwordHash' in response.body.data.user));
});

test('profile update validates the avatar URL and ignores unknown fields', async () => {
  const badUrl = await call('patch', '/api/auth/me', {
    token: world.tokens.customer,
    body: { avatarUrl: 'javascript:alert(1)' },
  });
  assert.equal(badUrl.status, 400);

  const ok = await call('patch', '/api/auth/me', {
    token: world.tokens.customer,
    body: { name: 'Renamed Customer', role: 'ADMIN' },
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.user.name, 'Renamed Customer');
  assert.equal(ok.body.data.user.role, 'CUSTOMER', 'role must not be self-assignable');
});

test('password change requires the current password and a different new one', async () => {
  const wrongCurrent = await call('patch', '/api/auth/password', {
    token: world.tokens.customer,
    body: { currentPassword: 'nope', newPassword: 'newsecret123' },
  });
  assert.equal(wrongCurrent.status, 400);

  const same = await call('patch', '/api/auth/password', {
    token: world.tokens.customer,
    body: { currentPassword: passwords.customer, newPassword: passwords.customer },
  });
  assert.equal(same.status, 400);

  const changed = await call('patch', '/api/auth/password', {
    token: world.tokens.customer,
    body: { currentPassword: passwords.customer, newPassword: 'brand-new-pass' },
  });
  assert.equal(changed.status, 200);

  const oldLogin = await call('post', '/api/auth/login', {
    body: { email: 'customer@test.dev', password: passwords.customer },
  });
  assert.equal(oldLogin.status, 401);

  const newLogin = await call('post', '/api/auth/login', {
    body: { email: 'customer@test.dev', password: 'brand-new-pass' },
  });
  assert.equal(newLogin.status, 200);
});

test('email availability check is case insensitive', async () => {
  const taken = await call('get', '/api/auth/check-email?email=CUSTOMER@test.dev');
  assert.equal(taken.status, 200);
  assert.equal(taken.body.data.available, false);

  const free = await call('get', '/api/auth/check-email?email=fresh@test.dev');
  assert.equal(free.body.data.available, true);
});
