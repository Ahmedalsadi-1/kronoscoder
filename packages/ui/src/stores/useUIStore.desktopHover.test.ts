import { beforeEach, describe, expect, it } from 'bun:test';
import { useUIStore } from './useUIStore';

describe('useUIStore desktop hover assist', () => {
  beforeEach(() => {
    useUIStore.setState({
      activeMainTab: 'chat',
      desktopHoverActive: false,
      desktopHoverPinned: false,
      desktopHoverTaskID: null,
      desktopHoverAlwaysOnTop: true,
      desktopHoverRestoreTab: null,
    });
  });

  it('captures previous tab when hover assist is activated', () => {
    useUIStore.setState({ activeMainTab: 'browser' });
    useUIStore.getState().activateDesktopHover('task-123', false);

    const state = useUIStore.getState();
    expect(state.desktopHoverActive).toBe(true);
    expect(state.desktopHoverTaskID).toBe('task-123');
    expect(state.desktopHoverAlwaysOnTop).toBe(false);
    expect(state.desktopHoverRestoreTab).toBe('browser');
  });

  it('clears hover state when deactivated', () => {
    useUIStore.setState({ activeMainTab: 'browser' });
    useUIStore.getState().activateDesktopHover('task-abc', true);
    useUIStore.getState().setDesktopHoverPinned(true);

    useUIStore.getState().deactivateDesktopHover();

    const state = useUIStore.getState();
    expect(state.desktopHoverActive).toBe(false);
    expect(state.desktopHoverTaskID).toBeNull();
    expect(state.desktopHoverPinned).toBe(false);
    expect(state.desktopHoverRestoreTab).toBeNull();
  });
});
