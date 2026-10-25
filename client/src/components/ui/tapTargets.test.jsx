import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '../../lib/i18n.jsx';
import { Button } from './Button.jsx';
import { SegmentedControl } from './SegmentedControl.jsx';
import { Modal } from './Modal.jsx';

// Touch targets must be at least 48 px (h-12) — spec 9.3.
describe('tap targets', () => {
  it('every button size is at least 48 px tall', () => {
    render(
      <>
        <Button size="sm">Small</Button>
        <Button>Medium</Button>
        <Button size="lg">Large</Button>
      </>
    );
    for (const name of ['Small', 'Medium', 'Large']) {
      expect(screen.getByRole('button', { name }).className).toMatch(/\bh-1[2-9]\b/);
    }
  });

  it('segments and the modal close button are 48 px', () => {
    render(
      <I18nProvider>
        <SegmentedControl
          label="Show"
          value="a"
          onChange={() => {}}
          options={[{ value: 'a', label: 'Daily' }]}
        />
        <Modal open onClose={() => {}} title="T">
          x
        </Modal>
      </I18nProvider>
    );
    expect(screen.getByRole('radio', { name: 'Daily' }).className).toMatch(/\bh-12\b/);
    expect(screen.getByRole('button', { name: 'Close' }).className).toMatch(/\bh-12\b/);
  });
});
