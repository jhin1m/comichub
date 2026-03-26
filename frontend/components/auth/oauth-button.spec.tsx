import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/tests/test-utils';
import { OAuthButton } from './oauth-button';

describe('OAuthButton', () => {
  it('renders a button with Google text', () => {
    render(<OAuthButton />);
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
  });

  it('stores oauth_state in sessionStorage and sets redirect URL on click', async () => {
    const setItemSpy = vi.spyOn(window.sessionStorage, 'setItem');
    const originalLocation = window.location;
    // Replace location with a writable object so we can assert href change
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: { ...originalLocation, href: '' },
    });

    const user = userEvent.setup();
    render(<OAuthButton />);

    await user.click(screen.getByRole('button', { name: /continue with google/i }));

    expect(setItemSpy).toHaveBeenCalledWith('oauth_state', expect.any(String));
    expect(window.location.href).toContain('/auth/google');

    // Restore
    Object.defineProperty(window, 'location', { writable: true, configurable: true, value: originalLocation });
    setItemSpy.mockRestore();
  });
});
