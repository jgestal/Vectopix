// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sidebar } from './Sidebar';
import { renderWithServices } from '../../test/renderWithServices';
import { DEFAULT_OPTIONS } from '../../domain/presets';
import type { VectorOptions } from '../../domain/types';

/** The sidebar with real option state, reporting each change. */
function Harness({ onChange, onPreset }: { onChange: (o: VectorOptions) => void; onPreset: (p: string) => void }) {
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  return (
    <Sidebar
      options={options}
      setOptions={(update) => {
        setOptions((prev) => {
          const next = typeof update === 'function' ? update(prev) : update;
          onChange(next);
          return next;
        });
      }}
      onApplyPreset={onPreset}
      palette={[{ hex: '#ff0000', r: 255, g: 0, b: 0, a: 255, count: 1, percentage: 50 }]}
      onSelectColor={vi.fn()}
      isProcessing={false}
      onRetrace={vi.fn()}
      onSimplifyNodes={vi.fn()}
      nodesCount={42}
    />
  );
}

function renderSidebar() {
  const onChange = vi.fn();
  const onPreset = vi.fn();
  renderWithServices(<Harness onChange={onChange} onPreset={onPreset} />);
  return { onChange, onPreset, last: () => onChange.mock.lastCall?.[0] as VectorOptions };
}

describe('Sidebar', () => {
  it('turns on the transparent background, making the settings custom', async () => {
    const { last } = renderSidebar();
    await userEvent.click(screen.getByText('Advanced settings'));
    await userEvent.click(screen.getByRole('checkbox', { name: /Transparent background/ }));
    expect(last()).toMatchObject({ transparentBackground: true, preset: 'custom' });
  });

  it('shows the colour slider only when automatic detection is off', async () => {
    const { last } = renderSidebar();
    expect(screen.queryByRole('slider', { name: 'Number of colours' })).toBeNull();
    await userEvent.click(screen.getByRole('checkbox', { name: /Detect automatically/ }));
    expect(last().autoColors).toBe(false);
    expect(screen.getByRole('slider', { name: 'Number of colours' })).toBeTruthy();
  });

  it('applies a preset', async () => {
    const { onPreset } = renderSidebar();
    await userEvent.click(screen.getByRole('radio', { name: /Exact pixel art/ }));
    expect(onPreset).toHaveBeenCalledWith('pixel-art');
  });

  it('switches to centerline tracing with its own presets', async () => {
    const { last } = renderSidebar();
    await userEvent.click(screen.getByRole('button', { name: 'Centerline' }));
    expect(last()).toMatchObject({ traceMethod: 'centerline', preset: 'centerline-sketch' });
    expect(screen.getByText('Stroke width')).toBeTruthy();
  });
});
