'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authApi } from '@/lib/api/auth.api';
import { TurnstileWidget, type TurnstileWidgetRef } from './turnstile-widget';

const schema = z.object({
  email: z.email('Invalid email'),
});

type FormData = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef<TurnstileWidgetRef>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await authApi.forgotPassword({ ...data, turnstileToken });
      setSubmitted(true);
      toast.success('Check your email for a reset link');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Something went wrong. Please try again.';
      setError('root', { message });
    } finally {
      turnstileRef.current?.reset();
      setTurnstileToken('');
    }
  };

  if (submitted) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-secondary">
          If that email is registered, you'll receive a password reset link shortly.
        </p>
        <Link href="/login" className="text-accent hover:underline text-sm">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <p className="text-secondary text-sm">
        Enter your email and we'll send you a link to reset your password.
      </p>
      <Input
        label="Email"
        type="email"
        error={errors.email?.message}
        {...register('email')}
      />
      {errors.root && <p className="text-accent text-sm">{errors.root.message}</p>}
      <TurnstileWidget ref={turnstileRef} onVerify={setTurnstileToken} />
      <Button variant="primary" type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Sending...' : 'Send Reset Link'}
      </Button>
      <p className="text-center">
        <Link href="/login" className="text-sm text-accent hover:underline">
          Back to login
        </Link>
      </p>
    </form>
  );
}
