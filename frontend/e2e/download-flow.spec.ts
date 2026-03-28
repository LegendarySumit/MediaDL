import { test, expect } from '@playwright/test';

test('user can fetch info and trigger async download flow', async ({ page }) => {
  await page.route('**/api/info?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        title: 'Sample Video',
        thumbnail: 'https://example.com/thumb.jpg',
        duration: 90,
        duration_string: '1:30',
        uploader: 'Tester',
        view_count: 1500,
        like_count: 100,
        ffmpeg: true,
        formats: [
          { format_id: 'bestvideo+bestaudio/best', label: 'Best Quality (Auto-Merged MP4)', note: 'Recommended' },
          { format_id: 'bestaudio/best', label: 'Audio Only (Best Quality)', note: 'Audio only' },
        ],
      }),
    });
  });

  await page.route('**/api/jobs', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        job_id: 'job-123',
        status: 'queued',
        progress: 0,
        message: 'Queued for processing',
      }),
    });
  });

  await page.route('**/api/progress?id=job-123', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: [
        'data: {"jobId":"job-123","status":"processing","progress":40,"message":"Downloading 40%"}\n\n',
        'data: {"jobId":"job-123","status":"completed","progress":100,"message":"Download ready","fileName":"sample.mp4","fallbackUrl":"/downloads/sample.mp4"}\n\n',
      ].join(''),
    });
  });

  await page.route('**/api/jobs/job-123/file', async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
      },
      body: Buffer.from('fake-content'),
    });
  });

  await page.goto('/');

  await page.getByPlaceholder('https://youtube.com/watch?v=...').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await page.getByRole('button', { name: 'Fetch' }).click();

  await expect(page.getByText('Sample Video')).toBeVisible();

  await page.getByRole('button', { name: 'Download Now' }).click();
  await expect(page.getByText(/Download Started!/i)).toBeVisible();
});
