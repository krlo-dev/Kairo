import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { AuthLayout } from '../../components/AuthLayout';
import { Field } from '../../components/ui/Field';
import { login as apiLogin } from '../../lib/auth';
import { useAuthStore } from '../../store/auth.store';
import { errorMessage } from '../../lib/errorMessage';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Requerido'),
});
type FormValues = z.infer<typeof schema>;

interface LocationState {
  from?: string;
}

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const from = (location.state as LocationState | null)?.from ?? '/dashboard';

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const user = await apiLogin(values);
      setUser(user);
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <AuthLayout
      title="Bienvenido de vuelta"
      footer={
        <>
          ¿Eres nuevo en Kairo?{' '}
          <Link to="/register" className="text-kairo-amber hover:underline">
            Crea una cuenta
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          {...register('email')}
          {...(errors.email?.message ? { error: errors.email.message } : {})}
        />
        <Field
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          {...register('password')}
          {...(errors.password?.message ? { error: errors.password.message } : {})}
        />
        <div className="text-right">
          <Link to="/forgot-password" className="text-kairo-small text-kairo-amber hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? 'Ingresando...' : 'Iniciar sesión'}
        </button>
      </form>
    </AuthLayout>
  );
}
