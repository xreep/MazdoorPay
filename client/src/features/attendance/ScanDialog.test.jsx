import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import { API, HttpResponse, http, server } from '../../test/server.js';
import { renderWithProviders } from '../../test/render.jsx';
import { ScanDialog } from './ScanDialog.jsx';

// A stand-in for the camera: the test shows it a card by calling `scanner.see(code)`.
const camera = vi.hoisted(() => ({ see: null, fail: null, stopped: 0 }));
vi.mock('qr-scanner', () => ({
  default: class {
    constructor(_video, onDecode) {
      camera.see = (data) => onDecode({ data });
    }
    start() {
      return camera.fail ? Promise.reject(camera.fail) : Promise.resolve();
    }
    stop() {
      camera.stopped += 1;
    }
    destroy() {}
  },
}));

const RAMESH = { _id: 'w1', name: 'Ramesh Yadav', role: 'mason' };

beforeEach(() => {
  camera.see = null;
  camera.fail = null;
  camera.stopped = 0;
});

const open = () => renderWithProviders(<ScanDialog open onClose={() => {}} />);
const show = async (code) => {
  await waitFor(() => expect(camera.see).toBeTypeOf('function'));
  await act(async () => camera.see(code));
};

describe('ScanDialog', () => {
  it('marks the worker on the card present and lists the scan', async () => {
    const posts = [];
    server.use(
      http.post(API('/attendance/scan'), async ({ request }) => {
        posts.push(await request.json());
        return HttpResponse.json({ result: 'marked', status: 'present', worker: RAMESH });
      })
    );
    open();
    await show('MP1.card-one');
    const dialog = screen.getByRole('dialog', { name: 'Scan ID cards' });
    expect(await within(dialog).findByRole('status')).toHaveTextContent(
      'Ramesh Yadav marked present'
    );
    expect(posts).toEqual([{ code: 'MP1.card-one' }]);
    expect(within(dialog).getByRole('list', { name: 'Scanned this time' })).toHaveTextContent(
      'Ramesh Yadav'
    );
  });

  it('ignores the same card held in front of the camera, and says when a worker was already marked', async () => {
    let calls = 0;
    server.use(
      http.post(API('/attendance/scan'), () => {
        calls += 1;
        return HttpResponse.json({ result: 'already', status: 'half-day', worker: RAMESH });
      })
    );
    open();
    await show('MP1.card-one');
    await show('MP1.card-one');
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Ramesh Yadav was already marked: Half-day'
    );
    expect(calls).toBe(1);
  });

  it("shows the server's reason when a card is refused", async () => {
    server.use(
      http.post(API('/attendance/scan'), () =>
        HttpResponse.json(
          { error: "This card has been replaced. Use the worker's new card." },
          { status: 400 }
        )
      )
    );
    open();
    await show('MP1.old-card');
    expect(await screen.findByRole('alert')).toHaveTextContent('This card has been replaced');
  });

  it('explains when the camera cannot be used', async () => {
    camera.fail = Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
    open();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Allow camera access in your browser to scan cards.'
    );
  });
});
