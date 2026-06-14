import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { verifyEmail as apiVerifyEmail } from '../../lib/auth';
import { AuthLayout } from '../../components/AuthLayout';
import { errorMessage } from '../../lib/errorMessage';

type Status = 'pending' | 'verifying' | 'success' | 'error';

export function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');

  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'pending');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    apiVerifyEmail(token)
      .then(() => {
        if (cancelled) return;
        setStatus('success');
        setTimeout(() => navigate('/login', { replace: true }), 1500);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setMessage(errorMessage(err, 'Enlace de verificación inválido o caducado'));
      });
    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  if (!token) {
    return (
      <AuthLayout
        title="Confirma tu email"
        subtitle="Te enviamos un enlace de verificación. Revisa tu bandeja de entrada (o spam) y vuelve aquí."
        footer={
          <Link to="/login" className="text-kairo-amber hover:underline">
            Volver al inicio de sesión
          </Link>
        }
      >
        <p className="text-kairo-body text-neutral-600 dark:text-neutral-300">
          El enlace caduca en 24 horas. Si no llega, revisa que el email sea correcto e intenta
          registrarte de nuevo en unos minutos.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Verificando tu email...">
      {status === 'verifying' && (
        <p className="text-kairo-body text-neutral-600 dark:text-neutral-300">
          Un segundo, estamos confirmando tu cuenta.
        </p>
      )}
      {status === 'success' && (
        <p className="text-kairo-body text-semantic-down">
          ¡Listo! Tu email quedó verificado. Redirigiendo al inicio de sesión...
        </p>
      )}
      {status === 'error' && (
        <>
          <p className="text-kairo-body text-semantic-up">{message}</p>
          <div className="mt-4 flex items-center gap-3">
            <Link to="/login" className="btn-ghost">
              Volver al login
            </Link>
            <Link to="/register" className="btn-primary">
              Registrarme de nuevo
            </Link>
          </div>
        </>
      )}
    </AuthLayout>
  );
}
