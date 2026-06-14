import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { AuthLayout } from '../../components/AuthLayout';
import { Field } from '../../components/ui/Field';
import { register as apiRegister } from '../../lib/auth';
import { errorMessage } from '../../lib/errorMessage';

const schema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(80),
  email: z.string().email('Email inválido').max(254),
  password: z.string().min(8, 'Mínimo 8 caracteres').max(72),
});
type FormValues = z.infer<typeof schema>;

export function Register() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      await apiRegister(values);
      toast.success('Cuenta creada. Revisa tu email para confirmar.');
      navigate('/verify-email', { state: { email: values.email } });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <AuthLayout
      title="Crea tu cuenta"
      subtitle="Empieza a rastrear precios en minutos."
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-kairo-amber hover:underline">
            Inicia sesión
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field
          label="Nombre"
          autoComplete="name"
          {...register('name')}
          {...(errors.name?.message ? { error: errors.name.message } : {})}
        />
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
          autoComplete="new-password"
          {...register('password')}
          {...(errors.password?.message
            ? { error: errors.password.message }
            : { hint: 'Mínimo 8 caracteres' })}
        />
        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? 'Creando...' : 'Crear cuenta'}
        </button>
      </form>
    </AuthLayout>
  );
}
