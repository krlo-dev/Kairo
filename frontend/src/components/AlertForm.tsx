import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { Field } from './ui/Field';
import { createAlert, type AlertDirection, type AlertMode } from '../lib/alerts';
import { errorMessage } from '../lib/errorMessage';

interface Props {
  trackedProductId: string;
  onCreated: () => void;
}

export function AlertForm({ trackedProductId, onCreated }: Props) {
  const [direction, setDirection] = useState<AlertDirection>('DOWN');
  const [mode, setMode] = useState<AlertMode>('ONE_SHOT');
  const [targetPrice, setTargetPrice] = useState('');
  const [pctThreshold, setPctThreshold] = useState('');
  const [cooldownDays, setCooldownDays] = useState('7');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createAlert({
        trackedProductId,
        mode,
        direction,
        targetPrice: direction === 'PCT' ? null : Number(targetPrice),
        pctThreshold: direction === 'PCT' ? Number(pctThreshold) : null,
        ...(mode === 'RECURRING' ? { cooldownDays: Number(cooldownDays) } : {}),
      });
      toast.success('Alerta creada.');
      setTargetPrice('');
      setPctThreshold('');
      onCreated();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-kairo-small font-medium text-neutral-700 dark:text-neutral-200">
            Avisarme cuando
          </label>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as AlertDirection)}
            className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-kairo-body text-neutral-900 focus:border-kairo-amber focus:outline-none focus:ring-2 focus:ring-kairo-amber/30 dark:border-kairo-borderDark dark:bg-kairo-navy dark:text-neutral-50"
          >
            <option value="DOWN">Baje hasta cierto precio</option>
            <option value="UP">Suba hasta cierto precio</option>
            <option value="PCT">Cambie un % desde hoy</option>
          </select>
        </div>
        <div>
          <label className="block text-kairo-small font-medium text-neutral-700 dark:text-neutral-200">
            Repetición
          </label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as AlertMode)}
            className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-kairo-body text-neutral-900 focus:border-kairo-amber focus:outline-none focus:ring-2 focus:ring-kairo-amber/30 dark:border-kairo-borderDark dark:bg-kairo-navy dark:text-neutral-50"
          >
            <option value="ONE_SHOT">Una sola vez</option>
            <option value="RECURRING">Cada vez que se cumpla</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {direction === 'PCT' ? (
          <Field
            label="% de cambio (negativo = baja, positivo = sube)"
            type="number"
            step="0.1"
            placeholder="Ej: -10"
            value={pctThreshold}
            onChange={(e) => setPctThreshold(e.target.value)}
            required
          />
        ) : (
          <Field
            label="Precio objetivo"
            type="number"
            min={0}
            placeholder="0"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            required
          />
        )}
        {mode === 'RECURRING' ? (
          <Field
            label="Días de espera entre avisos"
            type="number"
            min={1}
            max={90}
            value={cooldownDays}
            onChange={(e) => setCooldownDays(e.target.value)}
          />
        ) : null}
      </div>

      <button type="submit" disabled={submitting} className="btn-primary text-sm">
        {submitting ? 'Creando...' : 'Crear alerta'}
      </button>
    </form>
  );
}
