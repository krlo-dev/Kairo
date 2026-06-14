export function Landing() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-24">
      <section className="text-center">
        <p className="text-kairo-label uppercase tracking-wider text-kairo-amber">
          Inteligencia de precios LATAM
        </p>
        <h1 className="mt-4 text-kairo-h1 text-neutral-900 dark:text-neutral-50">
          El momento exacto para comprar.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-kairo-body text-neutral-600 dark:text-neutral-300">
          Kairo rastrea precios en Mercado Libre y AliExpress, te avisa cuando bajan y te ayuda
          a decidir cuándo importar. Datos primero, sin ruido.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <button type="button" className="btn-primary" disabled>
            Empezar gratis (próximamente)
          </button>
          <a href="#features" className="btn-ghost">
            Ver cómo funciona
          </a>
        </div>
        <p className="mt-6 text-kairo-small text-neutral-500">
          v.1 en desarrollo · Fase 0 completada
        </p>
      </section>

      <section id="features" className="mt-32 grid gap-12 md:grid-cols-3">
        <Feature
          title="Rastrea"
          body="Productos de Mercado Libre y AliExpress en un solo lugar, con historial completo de precio."
        />
        <Feature
          title="Compara"
          body="Trending por país, comparación de márgenes, exports CSV para comerciantes."
        />
        <Feature
          title="Actúa"
          body="Alertas por email o WhatsApp en el instante que el precio cumple tu objetivo."
        />
      </section>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="text-kairo-h3 text-kairo-amber">{title}</h3>
      <p className="mt-3 text-kairo-body text-neutral-600 dark:text-neutral-300">{body}</p>
    </div>
  );
}
