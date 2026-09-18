const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

async function harness({ fail = false } = {}) {
  const calls = { transports: [], messages: [], logs: [] };
  const original = Module._load;
  const resolved = require.resolve('../utils/email');
  delete require.cache[resolved];
  Module._load = function(name, parent, isMain) {
    if (name === 'nodemailer') return {
      createTransport(options) {
        calls.transports.push(options);
        return { async sendMail(message) {
          calls.messages.push(message);
          if (fail) throw Object.assign(new Error('transport failure raw-secret-token'), { code: 'SMTP_FAILURE' });
          return { messageId: 'synthetic-message-id' };
        } };
      }
    };
    if (name === './logger') return { logger: {
      info: (...args) => calls.logs.push(['info', ...args]),
      warn: (...args) => calls.logs.push(['warn', ...args]),
      error: (...args) => calls.logs.push(['error', ...args])
    } };
    return original.call(this, name, parent, isMain);
  };
  let api;
  try { api = require(resolved); } finally { Module._load = original; }
  return { api, calls };
}

test('onboarding email uses the configured transport and does not log its verification token', async () => {
  const old = { host: process.env.SMTP_HOST, port: process.env.SMTP_PORT, user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
  process.env.SMTP_HOST = 'smtp.example.invalid'; process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'mailer@example.invalid'; process.env.SMTP_PASS = 'synthetic-password';
  try {
    const h = await harness();
    const token = 'raw-secret-token';
    const result = await h.api.sendEmail({
      email: 'owner@example.invalid', subject: 'Continue setup',
      html: `<a href="https://example.invalid/#token=${token}">Continue</a>`
    });
    assert.equal(result.success, true);
    assert.equal(h.calls.transports.length, 1);
    assert.equal(h.calls.messages.length, 1);
    assert.equal(JSON.stringify(h.calls.logs).includes(token), false);

    const failed = await harness({ fail: true });
    await assert.rejects(() => failed.api.sendEmail({
      email: 'owner@example.invalid', subject: 'Continue setup', html: `<p>${token}</p>`
    }), error => error.code === 'EMAIL_DELIVERY_FAILED' && error.message === 'Failed to send email');
    assert.equal(JSON.stringify(failed.calls.logs).includes(token), false);
  } finally {
    for (const [key, value] of Object.entries(old)) {
      const name = `SMTP_${key.toUpperCase()}`;
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
