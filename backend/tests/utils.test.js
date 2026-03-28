process.env.DISABLE_QUEUE = 'true';
process.env.CAPTCHA_REQUIRED = 'false';

const { detectPlatform, formatDuration } = require('../server');

describe('utility helpers', () => {
  test('detectPlatform identifies supported providers', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc')).toBe('youtube');
    expect(detectPlatform('https://www.instagram.com/reel/abc')).toBe('instagram');
    expect(detectPlatform('https://www.tiktok.com/@x/video/123')).toBe('tiktok');
    expect(detectPlatform('https://example.com/video')).toBe('other');
  });

  test('formatDuration creates mm:ss and hh:mm:ss output', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3661)).toBe('1:01:01');
  });
});
