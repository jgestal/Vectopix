// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useVectorization } from './useVectorization';
import { fakeServices, Providers, tracedResult } from '../../test/renderWithServices';
import { DEFAULT_OPTIONS } from '../../domain/presets';
import type { VectorResult } from '../../domain/types';

const image = { width: 2, height: 2, data: new Uint8ClampedArray(16) };

/** A vectorize whose answers the test releases one by one, in any order. */
function controlledEngine() {
  const pending: ((r: VectorResult) => void)[] = [];
  const vectorize = vi.fn(() => new Promise<VectorResult>((resolve) => pending.push(resolve)));
  return { vectorize, release: (i: number, result: VectorResult) => act(async () => pending[i](result)) };
}

function setup() {
  const engine = controlledEngine();
  const { services } = fakeServices({ vectorization: { vectorize: engine.vectorize, measureFidelity: vi.fn(async () => 0.9) } });
  const callbacks = { onTraced: vi.fn(), onFidelity: vi.fn(), onError: vi.fn() };
  const wrapper = ({ children }: { children: ReactNode }) => <Providers services={services}>{children}</Providers>;
  const hook = renderHook(() => useVectorization(callbacks), { wrapper });
  return { engine, callbacks, hook };
}

describe('useVectorization', () => {
  it('reports the newest trace and ignores an older one that finishes late', async () => {
    const { engine, callbacks, hook } = setup();
    act(() => void hook.result.current.run(image, 1, DEFAULT_OPTIONS));
    act(() => void hook.result.current.run(image, 1, { ...DEFAULT_OPTIONS, colors: 3 }));

    await engine.release(1, tracedResult({ shapes: 3 }));
    await engine.release(0, tracedResult({ shapes: 9 }));

    expect(callbacks.onTraced).toHaveBeenCalledTimes(1);
    expect(callbacks.onTraced.mock.calls[0][0].shapes).toBe(3);
    expect(hook.result.current.isProcessing).toBe(false);
  });

  it('is busy while tracing, then measures fidelity in the background', async () => {
    const { engine, callbacks, hook } = setup();
    act(() => void hook.result.current.run(image, 1, DEFAULT_OPTIONS));
    expect(hook.result.current.isProcessing).toBe(true);
    expect(hook.result.current.progress).toEqual({ stage: 'progress.start', percent: 5 });

    await engine.release(0, tracedResult());
    expect(hook.result.current.isProcessing).toBe(false);
    await waitFor(() => expect(callbacks.onFidelity).toHaveBeenCalledWith(tracedResult().svg, 0.9));
  });

  it('drops a trace in flight when cancelled', async () => {
    const { engine, callbacks, hook } = setup();
    act(() => void hook.result.current.run(image, 1, DEFAULT_OPTIONS));
    act(() => hook.result.current.cancel());
    expect(hook.result.current.isProcessing).toBe(false);
    await engine.release(0, tracedResult());
    expect(callbacks.onTraced).not.toHaveBeenCalled();
  });
});
