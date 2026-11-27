import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useCaaData } from '../../context/CaaDataContext';
import {
  DEFAULT_COLOR_BY_OPTION_TYPE,
  OPTION_TYPE_LABELS,
  type FitzgeraldColor,
  type OptionDoc,
  type OptionType,
  type PredicateDoc,
} from '../../types/caa';
import { MediaImage } from '../common/MediaImage';
import { AudioRecorderField } from './AudioRecorderField';
import { ImageUploader } from './ImageUploader';

const OPTION_TYPES: OptionType[] = ['food', 'color', 'habitat', 'sound', 'action', 'object'];

export function PredicatesAndOptionsManager() {
  const { predicates, options, savePredicate, deletePredicate, saveOption, deleteOption } =
    useCaaData();

  const [subTab, setSubTab] = useState<'predicates' | 'options'>('predicates');
  const [filterType, setFilterType] = useState<OptionType | 'all'>('all');

  const [editingPred, setEditingPred] = useState<PredicateDoc | null>(null);
  const [editingOpt, setEditingOpt] = useState<OptionDoc | null>(null);
  const [removedMediaIds, setRemovedMediaIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const handleSavePredicate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPred || !editingPred.label.trim()) return;
    setSaving(true);
    try {
      await savePredicate(
        {
          ...editingPred,
          label: editingPred.label.trim(),
          questionPrompt: editingPred.questionPrompt.trim(),
          fitzgeraldColor: 'green',
        },
        removedMediaIds,
      );
      setEditingPred(null);
      setRemovedMediaIds([]);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOpt || !editingOpt.label.trim()) return;
    setSaving(true);
    try {
      await saveOption(
        {
          ...editingOpt,
          label: editingOpt.label.trim(),
          spokenLabel: editingOpt.spokenLabel?.trim() || undefined,
        },
        removedMediaIds,
      );
      setEditingOpt(null);
      setRemovedMediaIds([]);
    } finally {
      setSaving(false);
    }
  };

  const filteredOptions =
    filterType === 'all' ? options : options.filter((o) => o.optionType === filterType);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex bg-slate-200/80 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => {
              setSubTab('predicates');
              setEditingOpt(null);
            }}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
              subTab === 'predicates' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Verbos / Preguntas ({predicates.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setSubTab('options');
              setEditingPred(null);
            }}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
              subTab === 'options' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Banco de Opciones ({options.length})
          </button>
        </div>

        {subTab === 'predicates' ? (
          <button
            type="button"
            onClick={() => {
              setRemovedMediaIds([]);
              setEditingPred({
                id: `pred_${Date.now()}`,
                label: '',
                questionPrompt: '',
                optionType: 'food',
                fitzgeraldColor: 'green',
                emojiFallback: '💬',
                imageMediaId: null,
                audioMediaId: null,
                order: predicates.length + 1,
              });
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold"
          >
            <Plus className="w-4 h-4" />
            Nuevo verbo
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              const initialType: OptionType = filterType === 'all' ? 'food' : filterType;
              setRemovedMediaIds([]);
              setEditingOpt({
                id: `opt_${Date.now()}`,
                label: '',
                spokenLabel: '',
                optionType: initialType,
                fitzgeraldColor: DEFAULT_COLOR_BY_OPTION_TYPE[initialType],
                emojiFallback: '✨',
                imageMediaId: null,
                audioMediaId: null,
              });
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold"
          >
            <Plus className="w-4 h-4" />
            Nueva opción
          </button>
        )}
      </div>

      {/* PESTAÑA VERBOS / PREDICADOS */}
      {subTab === 'predicates' && (
        <>
          {editingPred && (
            <form
              onSubmit={handleSavePredicate}
              className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm"
            >
              <h3 className="text-lg font-bold text-slate-900">Verbo / Conector</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Texto del verbo
                  </label>
                  <input
                    type="text"
                    required
                    value={editingPred.label}
                    onChange={(e) => setEditingPred({ ...editingPred, label: e.target.value })}
                    placeholder="ej. come, vive en"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Pregunta guía
                  </label>
                  <input
                    type="text"
                    required
                    value={editingPred.questionPrompt}
                    onChange={(e) =>
                      setEditingPred({ ...editingPred, questionPrompt: e.target.value })
                    }
                    placeholder="ej. ¿Qué come?"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Tipo de opciones
                  </label>
                  <select
                    value={editingPred.optionType}
                    onChange={(e) =>
                      setEditingPred({
                        ...editingPred,
                        optionType: e.target.value as OptionType,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    {OPTION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {OPTION_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Emoji</label>
                    <input
                      type="text"
                      value={editingPred.emojiFallback ?? ''}
                      onChange={(e) =>
                        setEditingPred({ ...editingPred, emojiFallback: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Orden</label>
                    <input
                      type="number"
                      value={editingPred.order}
                      onChange={(e) =>
                        setEditingPred({ ...editingPred, order: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ImageUploader
                  imageMediaId={editingPred.imageMediaId}
                  emojiFallback={editingPred.emojiFallback}
                  onChange={(nextId, oldId) => {
                    if (oldId) setRemovedMediaIds((prev) => [...prev, oldId]);
                    setEditingPred({ ...editingPred, imageMediaId: nextId });
                  }}
                />
                <AudioRecorderField
                  previewText={editingPred.label}
                  audioMediaId={editingPred.audioMediaId}
                  onChange={(nextId, oldId) => {
                    if (oldId) setRemovedMediaIds((prev) => [...prev, oldId]);
                    setEditingPred({ ...editingPred, audioMediaId: nextId });
                  }}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPred(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold"
                >
                  {saving ? 'Guardando...' : 'Guardar verbo'}
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {predicates.map((pred) => (
              <div
                key={pred.id}
                className="bg-white rounded-2xl border-l-4 border-l-[#22C55E] border border-slate-200 p-4 flex items-center gap-4"
              >
                <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                  <MediaImage
                    mediaId={pred.imageMediaId}
                    emojiFallback={pred.emojiFallback ?? '💬'}
                    alt={pred.label}
                    emojiClassName="text-3xl"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-900">{pred.label}</h4>
                  <p className="text-xs text-slate-500">
                    {pred.questionPrompt} • Tipo: {OPTION_TYPE_LABELS[pred.optionType]}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setRemovedMediaIds([]);
                      setEditingPred({ ...pred });
                    }}
                    className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`¿Eliminar verbo "${pred.label}"?`)) {
                        deletePredicate(pred);
                      }
                    }}
                    className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* PESTAÑA BANCO DE OPCIONES */}
      {subTab === 'options' && (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                filterType === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              Todas ({options.length})
            </button>
            {OPTION_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                  filterType === t
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600'
                }`}
              >
                {OPTION_TYPE_LABELS[t]} ({options.filter((o) => o.optionType === t).length})
              </button>
            ))}
          </div>

          {editingOpt && (
            <form
              onSubmit={handleSaveOption}
              className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm"
            >
              <h3 className="text-lg font-bold text-slate-900">Opción / Complemento</h3>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Texto en tarjeta
                  </label>
                  <input
                    type="text"
                    required
                    value={editingOpt.label}
                    onChange={(e) => setEditingOpt({ ...editingOpt, label: e.target.value })}
                    placeholder="ej. selva, carne, amarillo"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Cómo suena en frase (opcional)
                  </label>
                  <input
                    type="text"
                    value={editingOpt.spokenLabel ?? ''}
                    onChange={(e) => setEditingOpt({ ...editingOpt, spokenLabel: e.target.value })}
                    placeholder="ej. la selva (si difiere)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Tipo</label>
                  <select
                    value={editingOpt.optionType}
                    onChange={(e) => {
                      const nextType = e.target.value as OptionType;
                      setEditingOpt({
                        ...editingOpt,
                        optionType: nextType,
                        fitzgeraldColor: DEFAULT_COLOR_BY_OPTION_TYPE[nextType],
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  >
                    {OPTION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {OPTION_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Color</label>
                    <select
                      value={editingOpt.fitzgeraldColor}
                      onChange={(e) =>
                        setEditingOpt({
                          ...editingOpt,
                          fitzgeraldColor: e.target.value as FitzgeraldColor,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                    >
                      <option value="orange">Naranja</option>
                      <option value="blue">Azul</option>
                      <option value="purple">Morado</option>
                      <option value="green">Verde</option>
                      <option value="yellow">Amarillo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Emoji</label>
                    <input
                      type="text"
                      value={editingOpt.emojiFallback ?? ''}
                      onChange={(e) =>
                        setEditingOpt({ ...editingOpt, emojiFallback: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ImageUploader
                  imageMediaId={editingOpt.imageMediaId}
                  emojiFallback={editingOpt.emojiFallback}
                  onChange={(nextId, oldId) => {
                    if (oldId) setRemovedMediaIds((prev) => [...prev, oldId]);
                    setEditingOpt({ ...editingOpt, imageMediaId: nextId });
                  }}
                />
                <AudioRecorderField
                  label={
                    editingOpt.optionType === 'sound'
                      ? 'Audio del sonido real (MP3 recomendado)'
                      : 'Audio / Voz'
                  }
                  previewText={editingOpt.spokenLabel?.trim() || editingOpt.label}
                  audioMediaId={editingOpt.audioMediaId}
                  onChange={(nextId, oldId) => {
                    if (oldId) setRemovedMediaIds((prev) => [...prev, oldId]);
                    setEditingOpt({ ...editingOpt, audioMediaId: nextId });
                  }}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingOpt(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold"
                >
                  {saving ? 'Guardando...' : 'Guardar opción'}
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredOptions.map((opt) => (
              <div
                key={opt.id}
                className="bg-white rounded-2xl border border-slate-200 p-3.5 flex items-center gap-3"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                  <MediaImage
                    mediaId={opt.imageMediaId}
                    emojiFallback={opt.emojiFallback ?? '✨'}
                    alt={opt.label}
                    emojiClassName="text-2xl"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-900 truncate">{opt.label}</h4>
                  <p className="text-xs text-slate-500 truncate">
                    {OPTION_TYPE_LABELS[opt.optionType]}
                    {opt.spokenLabel && opt.spokenLabel !== opt.label
                      ? ` • Dice: "${opt.spokenLabel}"`
                      : ''}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setRemovedMediaIds([]);
                      setEditingOpt({ ...opt });
                    }}
                    className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`¿Eliminar opción "${opt.label}"?`)) {
                        deleteOption(opt);
                      }
                    }}
                    className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
