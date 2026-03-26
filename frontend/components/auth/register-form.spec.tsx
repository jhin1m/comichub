import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/tests/test-utils';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/mocks/handlers';
import { RegisterForm } from './register-form';

const BASE_URL = 'http://localhost:8080/api/v1';

describe('RegisterForm', () => {
  it('renders all fields', () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('validates required fields on submit', async () => {
    render(<RegisterForm />);

    const { fireEvent } = await import('@testing-library/react');
    fireEvent.submit(screen.getByRole('button', { name: /create account/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/min 2 characters/i)).toBeInTheDocument();
    });
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/name/i), 'Test User');
    // Leave email empty to trigger zod invalid_email, bypassing browser validation
    await user.type(screen.getByLabelText(/password/i), 'password123');

    const { fireEvent } = await import('@testing-library/react');
    fireEvent.submit(screen.getByRole('button', { name: /create account/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    });
  });

  it('shows API error when registration fails', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${BASE_URL}/auth/register`, () =>
        HttpResponse.json(
          { success: false, data: null, message: 'Email already taken' },
          { status: 409 },
        ),
      ),
    );

    render(<RegisterForm />);
    await user.type(screen.getByLabelText(/name/i), 'Test User');
    await user.type(screen.getByLabelText(/email/i), 'existing@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/email already taken/i)).toBeInTheDocument();
    });
  });
});
