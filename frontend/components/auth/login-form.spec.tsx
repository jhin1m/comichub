import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/tests/test-utils';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/mocks/handlers';
import { LoginForm } from './login-form';

const BASE_URL = 'http://localhost:8080/api/v1';
const envelope = (data: unknown) => ({ success: true, data, message: null });

describe('LoginForm', () => {
  it('renders email and password inputs', () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows validation error for invalid email via zod resolver', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    // Type a valid-looking email then clear it — submitting empty bypasses browser
    // native email constraint but triggers zod's z.email() check
    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'bad');
    await user.clear(emailInput);
    await user.type(screen.getByLabelText(/password/i), 'password123');

    // Use fireEvent.submit to bypass browser native validation gate
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    });
  });

  it('shows validation error when password is empty', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    // password intentionally left empty

    const { fireEvent } = await import('@testing-library/react');
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });

  it('disables button while submitting', async () => {
    const user = userEvent.setup();
    // Delay the login response so we can observe the submitting state
    server.use(
      http.post(`${BASE_URL}/auth/login`, async () => {
        await new Promise((r) => setTimeout(r, 100));
        return HttpResponse.json(envelope({
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
          expiresIn: 3600,
        }));
      }),
    );

    render(<LoginForm />);
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /signing in/i })).not.toBeInTheDocument();
    });
  });

  it('shows API error when login fails', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${BASE_URL}/auth/login`, () =>
        HttpResponse.json(
          { success: false, data: null, message: 'Invalid credentials' },
          { status: 401 },
        ),
      ),
    );

    render(<LoginForm />);
    await user.type(screen.getByLabelText(/email/i), 'bad@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });
});
