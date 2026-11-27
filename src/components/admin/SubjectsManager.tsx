import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useCaaData } from '../../context/CaaDataContext';
import { normalizePhrase } from '../../lib/speechEngine';
import {
  OPTION_TYPE_LABELS,
  type FitzgeraldColor,
  type SubjectDoc,
} from '../../types/caa';
import { MediaImage } from '../common/MediaImage';
import { AudioRecorderField } from './AudioRecorderField';
import { ImageUploader } from './ImageUploader';

export function SubjectsManager() {
  const { categories, predicates, options, subjects, saveSubject, deleteSubject } = useCaaData();
  const [filterCategoryId, setFilterCategoryId] = useState<string>('all');
  const [editing, setEditing] = useState<SubjectDoc | null>(null);
  const [removedMediaIds, setRemovedMediaIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    const defaultCategoryId =
      filterCategoryId !== 'all' ? filterCategoryId : (categories[0]?.id ?? '');
    setRemovedMediaIds([]);
    setEditing({
      id: `subj_${Date.now()}`,
      categoryId: defaultCategoryId,
      article: 'El',
      name: '',
      fitzgeraldColor: 'orange',
      emojiFallback: '🦁',
      imageMediaId: null,
      audioMediaId: null,
      soundEffectMediaId: null,
      order: subjects.length + 1,
      active: true,
      relations: {},
    });
  };

  const toggleRelationOption = (predicateId: string, optionId: string) => {
    if (!editing) return;
    const currentRel = editing.relations[predicateId] ?? { targetOptionIds: [] };
    const exists = currentRel.targetOptionIds.includes(optionId);
    const nextOptionIds = exists
      ? currentRel.targetOptionIds.filter((id) => id !== optionId)
      : [...currentRel.targetOptionIds, optionId];

    const nextRelations = { ...editing.relations };
    if (nextOptionIds.length === 0 && !currentRel.customPhraseOverride) {
      delete nextRelations[predicateId];
    } else {
      nextRelations[predicateId] = {
        ...currentRel,
        targetOptionIds: nextOptionIds,
      };
    }

    setEditing({ ...editing, relations: nextRelations });
  };

  const setRelationPhraseOverride = (predicateId: string, value: string) => {
    if (!editing) return;
    const currentRel = editing.relations[predicateId] ?? { targetOptionIds: [] };
    const nextRelations = {
      ...editing.relations,
      [predicateId]: {
        ...currentRel,
        customPhraseOverride: value.trim() ? value : undefined,
      },
    };
    setEditing({ ...editing, relations: nextRelations });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.name.trim() || !editing.categoryId) return;
    setSaving(true);
    try {
      // Limpiar relaciones vacías
      const cleanRelations: SubjectDoc['relations'] = {};
      for (const [predId, rel] of Object.entries(editing.relations)) {
        if (rel.targetOptionIds.length > 0) {
          cleanRelations[predId] = {
            targetOptionIds: rel.targetOptionIds,
            ...(rel.customPhraseOverride?.trim()
              ? { customPhraseOverride: rel.customPhraseOverride.trim() }
              : {}),
          };
        }
      }

      await saveSubject(
        {
          ...editing,
          article: editing.article.trim(),
          name: editing.name.trim(),
          relations: cleanRelations,
        },
        removedMediaIds,
      );
      setEditing(null);
      setRemovedMediaIds([]);
    } finally {
      setSaving(false);
    }
  };

  const visibleSubjects =
    filterCategoryId === 'all'
      ? subjects
      : subjects.filter((s) => s.categoryId === filterCategoryId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Sujetos (Animales, Familia, etc.)
          </h2>
          <p className="text-sm text-slate-500">
            Sube fotos desde PC o cámara del iPad y marca qué opciones corresponden a cada verbo.
          </p>
        </div>

        <button
          type="button"
          onClick={openNew}
          disabled={categories.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold disabled:opacity-40"
        >
          <Plus className="w-4 h-4" />
          Nuevo sujeto
        </button>
      </div>

      {/* Filtro por categoría */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilterCategoryId('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
            filterCategoryId === 'all'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-600'
          }`}
        >
          Todos ({subjects.length})
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setFilterCategoryId(cat.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
              filterCategoryId === cat.id
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600'
            }`}
          >
            {cat.name} ({subjects.filter((s) => s.categoryId === cat.id).length})
          </button>
        ))}
      </div>

      {editing && (
        <form
          onSubmit={handleSave}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5"
        >
          <h3 className="text-lg font-bold text-slate-900">
            {subjects.some((s) => s.id === editing.id) ? 'Editar sujeto' : 'Crear sujeto'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Categoría</label>
              <select
                required
                value={editing.categoryId}
                onChange={(e) => setEditing({ ...editing, categoryId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Artículo</label>
              <select
                value={editing.article}
                onChange={(e) => setEditing({ ...editing, article: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              >
                <option value="El">El</option>
                <option value="La">La</option>
                <option value="Los">Los</option>
                <option value="Las">Las</option>
                <option value="">(Sin artículo — ej. Papá)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre</label>
              <input
                type="text"
                required
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="ej. león, cebra, Papá"
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Color Fitzgerald
              </label>
              <select
                value={editing.fitzgeraldColor ?? 'orange'}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    fitzgeraldColor: e.target.value as FitzgeraldColor,
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              >
                <option value="orange">Naranja (Sustantivo / Animal)</option>
                <option value="yellow">Amarillo cálido (Persona)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Emoji</label>
                <input
                  type="text"
                  value={editing.emojiFallback ?? ''}
                  onChange={(e) => setEditing({ ...editing, emojiFallback: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Orden</label>
                <input
                  type="number"
                  value={editing.order}
                  onChange={(e) => setEditing({ ...editing, order: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={editing.active}
              onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            Visible en Modo Juego
          </label>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ImageUploader
              label="Foto del sujeto (cámara o galería)"
              imageMediaId={editing.imageMediaId}
              emojiFallback={editing.emojiFallback}
              onChange={(nextId, oldId) => {
                if (oldId) setRemovedMediaIds((prev) => [...prev, oldId]);
                setEditing({ ...editing, imageMediaId: nextId });
              }}
            />

            <AudioRecorderField
              label="Voz del nombre"
              previewText={normalizePhrase([editing.article, editing.name])}
              audioMediaId={editing.audioMediaId}
              onChange={(nextId, oldId) => {
                if (oldId) setRemovedMediaIds((prev) => [...prev, oldId]);
                setEditing({ ...editing, audioMediaId: nextId });
              }}
            />

            <AudioRecorderField
              label="Sonido real del animal (opcional)"
              previewText=""
              audioMediaId={editing.soundEffectMediaId ?? null}
              isSoundEffect
              onChange={(nextId, oldId) => {
                if (oldId) setRemovedMediaIds((prev) => [...prev, oldId]);
                setEditing({ ...editing, soundEffectMediaId: nextId });
              }}
            />
          </div>

          {/* Matriz de relaciones Verbo -> Opciones */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div>
              <h4 className="font-bold text-slate-900">
                Respuestas asociadas por verbo ({normalizePhrase([editing.article, editing.name]) || 'sujeto'})
              </h4>
              <p className="text-xs text-slate-500">
                Marca las opciones que corresponden a este sujeto. Las demás opciones del mismo tipo se usarán automáticamente como distractores barajados.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {predicates.map((pred) => {
                const matchingOptions = options.filter((o) => o.optionType === pred.optionType);
                const rel = editing.relations[pred.id];
                const selectedIds = rel?.targetOptionIds ?? [];

                return (
                  <div
                    key={pred.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900">{pred.label}</span>{' '}
                        <span className="text-xs text-slate-500">({pred.questionPrompt})</span>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                        {OPTION_TYPE_LABELS[pred.optionType]}
                      </span>
                    </div>

                    {matchingOptions.length === 0 ? (
                      <p className="text-xs text-slate-400">
                        No hay opciones de tipo "{OPTION_TYPE_LABELS[pred.optionType]}" en el banco todavía.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {matchingOptions.map((opt) => {
                          const checked = selectedIds.includes(opt.id);
                          return (
                            <label
                              key={opt.id}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium cursor-pointer transition ${
                                checked
                                  ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleRelationOption(pred.id, opt.id)}
                                className="rounded"
                              />
                              <span>{opt.emojiFallback}</span>
                              <span>{opt.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {selectedIds.length > 0 && (
                      <div>
                        <input
                          type="text"
                          value={rel?.customPhraseOverride ?? ''}
                          onChange={(e) => setRelationPhraseOverride(pred.id, e.target.value)}
                          placeholder="Frase personalizada opcional (ej. El león ruge fuerte)"
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-700"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="px-4 py-2 rounded-xl border border-slate-300 font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar sujeto'}
            </button>
          </div>
        </form>
      )}

      {/* Lista de sujetos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleSubjects.map((subj) => {
          const catName =
            categories.find((c) => c.id === subj.categoryId)?.name ?? 'Sin categoría';
          const predCount = Object.values(subj.relations ?? {}).filter(
            (r) => r.targetOptionIds?.length > 0,
          ).length;

          return (
            <div
              key={subj.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3.5 shadow-xs"
            >
              <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                <MediaImage
                  mediaId={subj.imageMediaId}
                  emojiFallback={subj.emojiFallback ?? '⭐'}
                  alt={subj.name}
                  emojiClassName="text-3xl"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-900 truncate">
                  {normalizePhrase([subj.article, subj.name])}
                </h4>
                <p className="text-xs text-slate-500">
                  {catName} • {predCount} preguntas
                </p>
                <span
                  className={`inline-block mt-1 text-[11px] font-semibold ${
                    subj.active ? 'text-emerald-700' : 'text-slate-400'
                  }`}
                >
                  {subj.active ? 'Activo' : 'Oculto'}
                </span>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setRemovedMediaIds([]);
                    setEditing({ ...subj, relations: { ...subj.relations } });
                  }}
                  className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`¿Eliminar "${normalizePhrase([subj.article, subj.name])}"?`)) {
                      deleteSubject(subj);
                    }
                  }}
                  className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
