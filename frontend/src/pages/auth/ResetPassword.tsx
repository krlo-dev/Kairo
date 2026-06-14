import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { AuthLayout } from '../../components/AuthLayout';
import { Field } from '../../components/ui/Field';
import { resetPassword } from '../../lib/auth';
import { errorMessage } from '../../lib/errorMessage';

const schema = z
  .object({
    newPassword: z.string().min(8, 'Mínimo 8 caracteres').max(72),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm'],
  });
type FormValues = z.infer<typeof schema>;

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (!token) {
    return (
      <AuthLayout
        title="Enlace inválido"
        footer={
          <Link to="/forgot-password" className="text-kairo-amber hover:underline">
            Pedir un nuevo enlace
          </Link>
        }
      >
        <p className="text-kairo-body text-semantic-up">
          El enlace de restablecimiento es inválido o está incompleto.
        </p>
      </AuthLayout>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      await resetPassword({ token, newPassword: values.newPassword });
      toast.success('Contraseña restablecida. Inicia sesión.');
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <AuthLayout
      title="Crea una nueva contraseña"
      subtitle="Esto cierra todas tus sesiones activas."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field
          label="Nueva contraseña"
          type="password"
          autoComplete="new-password"
          {...register('newPassword')}
          {...(errors.newPassword?.message
            ? { error: errors.newPassword.message }
            : { hint: 'Mínimo 8 caracteres' })}
        />
        <Field
          label="Confirma la contraseña"
          type="password"
          autoComplete="new-password"
          {...register('confirm')}
          {...(errors.confirm?.message ? { error: errors.confirm.message } : {})}
        />
        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? 'Guardando...' : 'Guardar nueva contraseña'}
        </button>
      </form>
    </AuthLayout>
  );
}
