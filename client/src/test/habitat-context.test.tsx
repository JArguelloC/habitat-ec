import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HabitatProvider } from '@/components/habitat/provider';
import * as originalContext from '@/components/habitat/context';

function Consumer() {
  const { properties, search } = originalContext.useHabitat();
  return <p>{properties.length} alojamientos · {search.adults} adultos</p>;
}

describe('Habitat context identity', () => {
  afterEach(() => { vi.resetModules(); });

  it('remains available to existing consumers after the provider module reloads', async () => {
    const view = render(<HabitatProvider><Consumer /></HabitatProvider>);
    expect(screen.getByText('6 alojamientos · 2 adultos')).toBeInTheDocument();
    // Model a provider invalidation without reloading its dependency-light context.
    vi.resetModules();
    vi.doMock('@/components/habitat/context', () => originalContext);
    const { HabitatProvider: RefreshedProvider } = await import('@/components/habitat/provider');
    await act(async () => view.rerender(<RefreshedProvider><Consumer /></RefreshedProvider>));
    expect(screen.getByText('6 alojamientos · 2 adultos')).toBeInTheDocument();
    vi.doUnmock('@/components/habitat/context');
  });
});