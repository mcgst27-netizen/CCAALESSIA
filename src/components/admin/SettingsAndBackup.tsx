import { useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  RefreshCw,
  Sparkles,
  Upload,
  Volume2,
  Wifi,
} from 'lucide-react';
import { useCaaData } from '../../context/CaaDataContext';
import { exportFullBackup, importFullBackup } from '../../lib/backupService';
import { seedInitialData } from '../../lib/seedData';
import {
  runAudioDiagnostic,
  type AudioDiagnosticReport,
} from '../../lib/speechEngine';

export function SettingsAndBackup() {
  const {
    config,
    categories,
    predicates,
    options,
    subjects,
    offlineStatus,
    syncAllOfflineMedia,
    saveConfig,
  } = useCaaData();

  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [diagnostic, setDiagnostic] = useState<AudioDiagnosticReport | null>(null);

  const updateConfigField = async <K extends keyof typeof config>(
    key: K,
    value: (typeof config)[K],
  ) => {
    setErrorMsg(null);
    try {
      await saveConfig({ ...config, [key]: value });
      setStatusMsg('Ajuste guardado correctamente.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo guardar el ajuste.');
    }
  };

  const handleSeed = async () => {
    if (
      !window.confirm(
        'Se crearán 2 categorías (Animales y Familia), 4 verbos, opciones básicas y sujetos de prueba (León, Cebra, Mono, Papá y Mamá). ¿Continuar?',
      )
    ) {
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await seedInitialData();
      setStatusMsg('Ejemplos iniciales cargados con éxito. Ya puedes jugar o personalizarlos.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al cargar ejemplos iniciales.');
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async () => {
    setBusy(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const payload = await exportFullBackup({
        config,
        categories,
        predicates,
        options,
        subjects,
      });
      setStatusMsg(
        `Respaldo exportado (${payload.subjects.length} sujetos, ${payload.media.length} archivos multimedia).`,
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al exportar respaldo.');
    } finally {
      setBusy(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setBusy(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const text = await file.text();
      const summary = await importFullBackup(text);
      setStatusMsg(
        `Respaldo importado: ${summary.categories} categorías, ${summary.predicates} verbos, ${summary.options} opciones, ${summary.subjects} sujetos y ${summary.media} archivos.`,
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al importar el archivo JSON.');
    } finally {
      setBusy(false);
    }
  };

  const handleAudioDiagnostic = async () => {
    setErrorMsg(null);
    const report = await runAudioDiagnostic();
    setDiagnostic(report);
  };

  const handleManualOfflineSync = async () => {
    setErrorMsg(null);
    const res = await syncAllOfflineMedia();
    setStatusMsg(
      `Sincronización offline completa: ${res.cached}/${res.total} archivos listos en este dispositivo (${res.newlyFetched} nuevos descargados).`,
    );
  };

  return (
    <div className="space-y-6">
      {statusMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {statusMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold">
          {errorMsg}
        </div>
      )}

      {/* 1. Ajustes Clínicos y de Juego */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5 shadow-xs">
        <h2 className="text-lg font-extrabold text-slate-900">
          Ajustes del Modo Juego (Baja Distracción)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <h3 className="font-bold text-slate-800 text-sm">Visualización de verbos / preguntas</h3>
            <p className="text-xs text-slate-500">
              En baja distracción se muestra 1 verbo rotativo a la vez. Puedes mostrar todos en columna fija si lo prefieres.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => updateConfigField('showAllPredicatesMode', false)}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border ${
                  !config.showAllPredicatesMode
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                1 pregunta rotativa
              </button>
              <button
                type="button"
                onClick={() => updateConfigField('showAllPredicatesMode', true)}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border ${
                  config.showAllPredicatesMode
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                Todos los verbos
              </button>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <h3 className="font-bold text-slate-800 text-sm">Opciones visibles por ronda</h3>
            <p className="text-xs text-slate-500">
              Se muestra 1 respuesta asociada al sujeto + distractores aleatorios del mismo tipo.
            </p>
            <div className="flex gap-2 pt-1">
              {([3, 4] as const).map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => updateConfigField('optionsPerRound', count)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border ${
                    config.optionsPerRound === count
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  {count} opciones
                </button>
              ))}
            </div>
          </div>

          <label className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(config.visualPromptDimDistractors)}
              onChange={(e) =>
                updateConfigField('visualPromptDimDistractors', e.target.checked)
              }
              className="mt-1 w-4 h-4 rounded"
            />
            <div>
              <span className="font-bold text-slate-800 text-sm block">
                Andamiaje visual sin error (atenuar distractores)
              </span>
              <span className="text-xs text-slate-500">
                Atenúa suavemente las opciones distractoras (50% opacidad) al enseñar conceptos nuevos.
              </span>
            </div>
          </label>

          <label className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(config.holdBackButtonInActivity)}
              onChange={(e) =>
                updateConfigField('holdBackButtonInActivity', e.target.checked)
              }
              className="mt-1 w-4 h-4 rounded"
            />
            <div>
              <span className="font-bold text-slate-800 text-sm block">
                Proteger botón "Volver" en Actividad (mantener 1 s)
              </span>
              <span className="text-xs text-slate-500">
                Evita salidas impulsivas durante terapia requiriendo 1 segundo continuo en "Volver".
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* 2. Offline iPad & Diagnóstico de Audio */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-xs">
          <div className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-emerald-600" />
            <h3 className="font-extrabold text-slate-900">Uso 100% sin internet (IndexedDB)</h3>
          </div>
          <p className="text-sm text-slate-600">
            Archivos multimedia guardados en este dispositivo:{' '}
            <strong>
              {offlineStatus.cached} / {offlineStatus.total}
            </strong>
            {offlineStatus.total === 0 && ' (solo usando voz del iPad y emojis)'}
          </p>
          <button
            type="button"
            disabled={offlineStatus.syncing}
            onClick={handleManualOfflineSync}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${offlineStatus.syncing ? 'animate-spin' : ''}`} />
            {offlineStatus.syncing ? 'Sincronizando...' : 'Sincronizar todo para uso offline'}
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-xs">
          <div className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-blue-600" />
            <h3 className="font-extrabold text-slate-900">Diagnóstico de Audio en iPad</h3>
          </div>
          <p className="text-xs text-slate-500">
            Verifica la voz en español de Safari y el modo <code>playback</code> para ignorar el Modo Silencio en iPadOS 17+.
          </p>
          <button
            type="button"
            onClick={handleAudioDiagnostic}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50"
          >
            <Volume2 className="w-4 h-4" />
            Probar voz y diagnóstico
          </button>
          {diagnostic && (
            <div className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1 text-slate-700">
              <div>
                <strong>Voz detectada:</strong> {diagnostic.voiceName} ({diagnostic.voiceLang})
              </div>
              <div>
                <strong>Ignorar Modo Silencio (audioSession):</strong>{' '}
                {diagnostic.audioSessionSupported
                  ? 'Activo (iPadOS 17+)'
                  : 'No soportado en este navegador (verifica que la campana del Centro de Control no esté en silencio)'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Datos Semilla y Respaldo JSON */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
        <h2 className="text-lg font-extrabold text-slate-900">
          Datos Iniciales y Respaldo de Seguridad
        </h2>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={handleSeed}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            Cargar ejemplos iniciales
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Exportar Respaldo JSON
          </button>

          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => importInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-bold hover:bg-slate-50 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            Importar Respaldo JSON
          </button>
        </div>
      </div>
    </div>
  );
}
