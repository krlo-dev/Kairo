import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AuthLayout } from '../../components/AuthLayout';
import { Field } from '../../components/ui/Field';
import { forgotPassword } from '../../lib/auth';
import { errorMessage } from '../../lib/errorMessage';

const schema = z.object({
  email: z.string().email('Email inválido'),
});
type FormValues = z.infer<typeof schema>;

export function ForgotPassword() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    setError(null);
    try {
      await forgotPassword(values.email);
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <AuthLayout
      title="Restablecer contraseña"
      subtitle="Te enviaremos un enlace si el email está registrado."
      footer={
        <Link to="/login" className="text-kairo-amber hover:underline">
          Volver al inicio de sesión
        </Link>
      }
    >
      {done ? (
        <p className="text-kairo-body text-neutral-700 dark:text-neutral-200">
          Si el email está registrado, en breve recibirás un enlace para crear una nueva contraseña.
          El enlace caduca en 1 hora.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            {...register('email')}
            {...(errors.email?.message ? { error: errors.email.message } : {})}
          />
          {error && <p className="text-kairo-small text-semantic-up">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Enviando...' : 'Enviar enlace'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
