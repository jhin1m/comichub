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

  it('redirects to Google OAuth URL on click', async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: { ...originalLocation, href: '' },
    });

    const user = userEvent.setup();
    render(<OAuthButton />);

    await user.click(screen.getByRole('button', { name: /continue with google/i }));

    expect(window.location.href).toContain('/auth/google');

    Object.defineProperty(window, 'location', { writable: true, configurable: true, value: originalLocation });
  });
});
