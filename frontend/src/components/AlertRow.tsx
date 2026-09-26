import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  deleteAlert,
  updateAlert,
  type Alert,
  type AlertDirection,
  type AlertMode,
} from '../lib/alerts';
import { errorMessage } from '../lib/errorMessage';
import { formatPrice, type Currency } from '../utils/formatPrice';

const DIRECTION_LABEL: Record<AlertDirection, string> = {
  DOWN: 'Baje hasta',
  UP: 'Suba hasta',
  PCT: 'Cambie',
};

const MODE_LABEL: Record<AlertMode, string> = {
  ONE_SHOT: 'una sola vez',
  RECURRING: 'cada vez que se cumpla',
};

function describeCondition(alert: Alert, currency: Currency): string {
  if (alert.direction === 'PCT') {
    const pct = alert.pctThreshold ?? 0;
    return `Cambie ${pct > 0 ? '+' : ''}${pct}% desde que se creó`;
  }
  const target = alert.targetPrice ? formatPrice(Number(alert.targetPrice), currency) : '—';
  return `${DIRECTION_LABEL[alert.direction]} ${target}`;
}

interface Props {
  alert: Alert;
  trackedProductId: string;
  currency: Currency;
}

export function AlertRow({ alert, trackedProductId, currency }: Props) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [direction, setDirection] = useState<AlertDirection>(alert.direction);
  const [mode, setMode] = useState<AlertMode>(alert.mode);
  const [targetPrice, setTargetPrice] = useState(alert.targetPrice ?? '');
  const [pctThreshold, setPctThreshold] = useState(String(alert.pctThreshold ?? ''));
  const [cooldownDays, setCooldownDays] = useState(String(alert.cooldownDays));

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['alerts', 'list', trackedProductId] });

  const updateMutation = useMutation({
    mutationFn: (input: Parameters<typeof updateAlert>[1]) => updateAlert(alert.id, input),
    onSuccess: () => {
      toast.success('Alerta actualizada.');
      void invalidate();
      setEditing(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteAlert(alert.id),
    onSuccess: () => {
      toast.success('Alerta eliminada.');
      void invalidate();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const toggleActive = () => updateMutation.mutate({ isActive: !alert.isActive });

  const saveEdit = (e: FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      mode,
      direction,
      targetPrice: direction === 'PCT' ? null : Number(targetPrice),
      pctThreshold: direction === 'PCT' ? Number(pctThreshold) : null,
      ...(mode === 'RECURRING' ? { cooldownDays: Number(cooldownDays) } : {}),
    });
  };

  const status =
    alert.triggered && alert.mode === 'ONE_SHOT'
      ? 'Disparada'
      : !alert.isActive
        ? 'Pausada'
        : 'Activa';

  const statusClass =
    status === 'Disparada'
      ? 'bg-neutral-200 text-neutral-600 dark:bg-kairo-navy dark:text-neutral-400'
      : status === 'Pausada'
        ? 'bg-neutral-100 text-neutral-500 dark:bg-kairo-navy dark:text-neutral-400'
        : 'bg-semantic-down/10 text-semantic-down';

  if (editing) {
    return (
      <form
        onSubmit={saveEdit}
        className="rounded-lg border border-neutral-200 p-4 dark:border-kairo-borderDark"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as AlertDirection)}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-kairo-small dark:border-kairo-borderDark dark:bg-kairo-navy dark:text-neutral-50"
          >
            <option value="DOWN">Baje hasta cierto precio</option>
            <option value="UP">Suba hasta cierto precio</option>
            <option value="PCT">Cambie un % desde hoy</option>
          </select>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as AlertMode)}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-kairo-small dark:border-kairo-borderDark dark:bg-kairo-navy dark:text-neutral-50"
          >
            <option value="ONE_SHOT">Una sola vez</option>
            <option value="RECURRING">Cada vez que se cumpla</option>
          </select>
          {direction === 'PCT' ? (
            <input
              type="number"
              step="0.1"
              value={pctThreshold}
              onChange={(e) => setPctThreshold(e.target.value)}
              placeholder="% de cambio"
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-kairo-small dark:border-kairo-borderDark dark:bg-kairo-navy dark:text-neutral-50"
              required
            />
          ) : (
            <input
              type="number"
              min={0}
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder="Precio objetivo"
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-kairo-small dark:border-kairo-borderDark dark:bg-kairo-navy dark:text-neutral-50"
              required
            />
          )}
          {mode === 'RECURRING' ? (
            <input
              type="number"
              min={1}
              max={90}
              value={cooldownDays}
              onChange={(e) => setCooldownDays(e.target.value)}
              placeholder="Días de espera"
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-kairo-small dark:border-kairo-borderDark dark:bg-kairo-navy dark:text-neutral-50"
            />
          ) : null}
        </div>
        <div className="mt-3 flex gap-2">
          <button type="submit" disabled={updateMutation.isPending} className="btn-primary text-sm">
            {updateMutation.isPending ? 'Guardando...' : 'Guardar'}
          </button>
          <button type="button" className="btn-ghost text-sm" onClick={() => setEditing(false)}>
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-4 dark:border-kairo-borderDark">
      <div>
        <p className="text-kairo-body text-neutral-900 dark:text-neutral-50">
          {describeCondition(alert, currency)}
        </p>
        <p className="mt-0.5 text-kairo-small text-neutral-500">
          {MODE_LABEL[alert.mode]}
          {alert.mode === 'RECURRING' ? ` · cada ${alert.cooldownDays}d` : ''}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass}`}>
          {status}
        </span>
        <button type="button" className="btn-ghost text-sm" onClick={() => setEditing(true)}>
          Editar
        </button>
        <button
          type="button"
          className="btn-ghost text-sm"
          disabled={updateMutation.isPending}
          onClick={toggleActive}
        >
          {alert.isActive ? 'Pausar' : 'Reanudar'}
        </button>
        <button
          type="button"
          className="btn-ghost text-sm text-semantic-up"
          disabled={deleteMutation.isPending}
          onClick={() => deleteMutation.mutate()}
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}
