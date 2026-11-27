import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useCaaData } from '../../context/CaaDataContext';
import type { CategoryDoc, FitzgeraldColor } from '../../types/caa';
import { MediaImage } from '../common/MediaImage';
import { AudioRecorderField } from './AudioRecorderField';
import { ImageUploader } from './ImageUploader';

const EMPTY_CATEGORY: CategoryDoc = {
  id: '',
  name: '',
  emojiFallback: '📂',
  fitzgeraldColor: 'orange',
  imageMediaId: null,
  audioMediaId: null,
  order: 1,
  active: true,
};

export function CategoriesManager() {
  const { categories, config, saveCategory, deleteCategory, saveConfig } = useCaaData();
  const [editing, setEditing] = useState<CategoryDoc | null>(null);
  const [removedMediaIds, setRemovedMediaIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setRemovedMediaIds([]);
    setEditing({
      ...EMPTY_CATEGORY,
      id: `cat_${Date.now()}`,
      order: categories.length + 1,
    });
  };

  const openEdit = (cat: CategoryDoc) => {
    setRemovedMediaIds([]);
    setEditing({ ...cat });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.name.trim()) return;
    setSaving(true);
    try {
      const cleanCat: CategoryDoc = {
        ...editing,
        name: editing.name.trim(),
      };
      await saveCategory(cleanCat, removedMediaIds);

      // Si está activa, asegurar que aparezca en visibleCategoryIds
      if (cleanCat.active && !config.visibleCategoryIds.includes(cleanCat.id)) {
        await saveConfig({
          ...config,
          visibleCategoryIds: [...config.visibleCategoryIds, cleanCat.id],
        });
      }
      setEditing(null);
      setRemovedMediaIds([]);
    } finally {
      setSaving(false);
    }
  };

  const toggleVisibility = async (cat: CategoryDoc) => {
    const isVisible = config.visibleCategoryIds.includes(cat.id);
    const nextIds = isVisible
      ? config.visibleCategoryIds.filter((id) => id !== cat.id)
      : [...config.visibleCategoryIds, cat.id];
    await saveConfig({ ...config, visibleCategoryIds: nextIds });
  };

  const handleDelete = async (cat: CategoryDoc) => {
    if (!window.confirm(`¿Eliminar la categoría "${cat.name}"?`)) return;
    await deleteCategory(cat);
    if (config.visibleCategoryIds.includes(cat.id)) {
      await saveConfig({
        ...config,
        visibleCategoryIds: config.visibleCategoryIds.filter((id) => id !== cat.id),
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Categorías de Inicio</h2>
          <p className="text-sm text-slate-500">
            Elige qué categorías se muestran en la pantalla principal.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800"
        >
          <Plus className="w-4 h-4" />
          Nueva categoría
        </button>
      </div>

      {editing && (
        <form
          onSubmit={handleSave}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4"
        >
          <h3 className="text-lg font-bold text-slate-900">
            {categories.some((c) => c.id === editing.id) ? 'Editar categoría' : 'Crear categoría'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre</label>
              <input
                type="text"
                required
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="Ej. Animales, Familia, Rutinas"
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Ícono de apoyo (emoji)
              </label>
              <input
                type="text"
                value={editing.emojiFallback ?? ''}
                onChange={(e) => setEditing({ ...editing, emojiFallback: e.target.value })}
                placeholder="🦁"
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Orden</label>
                <input
                  type="number"
                  value={editing.order}
                  onChange={(e) => setEditing({ ...editing, order: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Color borde</label>
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
                  <option value="orange">Naranja</option>
                  <option value="yellow">Amarillo</option>
                  <option value="green">Verde</option>
                  <option value="blue">Azul</option>
                  <option value="purple">Morado</option>
                </select>
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
            Categoría activa
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ImageUploader
              imageMediaId={editing.imageMediaId}
              emojiFallback={editing.emojiFallback}
              onChange={(nextId, oldId) => {
                if (oldId) setRemovedMediaIds((prev) => [...prev, oldId]);
                setEditing({ ...editing, imageMediaId: nextId });
              }}
            />
            <AudioRecorderField
              previewText={editing.name}
              audioMediaId={editing.audioMediaId}
              onChange={(nextId, oldId) => {
                if (oldId) setRemovedMediaIds((prev) => [...prev, oldId]);
                setEditing({ ...editing, audioMediaId: nextId });
              }}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar categoría'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map((cat) => {
          const visibleInHome =
            config.visibleCategoryIds.length === 0 ||
            config.visibleCategoryIds.includes(cat.id);
          return (
            <div
              key={cat.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-4 shadow-xs"
            >
              <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                <MediaImage
                  mediaId={cat.imageMediaId}
                  emojiFallback={cat.emojiFallback ?? '📂'}
                  alt={cat.name}
                  emojiClassName="text-3xl"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900 truncate">{cat.name}</h4>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    #{cat.order}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs">
                  <span className={cat.active ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                    {cat.active ? 'Activa' : 'Inactiva'}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleVisibility(cat)}
                    className="underline text-blue-600 font-medium"
                  >
                    {visibleInHome ? 'Visible en Inicio' : 'Oculta en Inicio'}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openEdit(cat)}
                  className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
                  title="Editar"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(cat)}
                  className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50"
                  title="Eliminar"
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
