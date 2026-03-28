process.env.DISABLE_QUEUE = 'true';
process.env.CAPTCHA_REQUIRED = 'false';

const request = require('supertest');
const { app } = require('../server');

describe('API routes', () => {
  test('GET /api/health returns ok', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  test('GET /api/info without URL returns 400', async () => {
    const response = await request(app).get('/api/info');
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/URL is required/i);
  });

  test('POST /api/jobs uses direct mode when queue disabled', async () => {
    const response = await request(app)
      .post('/api/jobs')
      .send({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });

    expect(response.status).toBe(200);
    expect(response.body.mode).toBe('direct');
  });
});
