import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-kairo-label uppercase tracking-wider text-kairo-amber">404</p>
        <h1 className="mt-4 text-kairo-h1">Página no encontrada</h1>
        <p className="mt-4 text-kairo-body text-neutral-600">
          La URL que buscás no existe o fue movida.
        </p>
        <Link to="/" className="btn-primary mt-8 inline-flex">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
