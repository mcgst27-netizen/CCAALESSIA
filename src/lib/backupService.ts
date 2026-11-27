import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { cacheMediaLocally, getUtf8ByteLength, MAX_MEDIA_BYTES } from './mediaCache';
import type {
  AppConfig,
  BackupPayload,
  CategoryDoc,
  MediaDoc,
  OptionDoc,
  PredicateDoc,
  SubjectDoc,
} from '../types/caa';

export async function exportFullBackup(params: {
  config: AppConfig;
  categories: CategoryDoc[];
  predicates: PredicateDoc[];
  options: OptionDoc[];
  subjects: SubjectDoc[];
}): Promise<BackupPayload> {
  if (!db) {
    throw new Error('Firebase no está configurado.');
  }

  const mediaSnap = await getDocs(collection(db, 'media'));
  const media: MediaDoc[] = mediaSnap.docs.map((d) => ({
    ...(d.data() as Omit<MediaDoc, 'id'>),
    id: d.id,
  }));

  const payload: BackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    config: params.config,
    categories: params.categories,
    predicates: params.predicates,
    options: params.options,
    subjects: params.subjects,
    media,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `respaldo-caa-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return payload;
}

export async function importFullBackup(jsonText: string): Promise<{
  categories: number;
  predicates: number;
  options: number;
  subjects: number;
  media: number;
}> {
  if (!db) {
    throw new Error('Firebase no está configurado.');
  }

  const parsed = JSON.parse(jsonText) as Partial<BackupPayload>;
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray(parsed.categories) ||
    !Array.isArray(parsed.predicates) ||
    !Array.isArray(parsed.options) ||
    !Array.isArray(parsed.subjects)
  ) {
    throw new Error('El archivo JSON no tiene el formato de respaldo CAA válido.');
  }

  const ops: Array<{ col: string; id: string; data: unknown }> = [];

  if (parsed.config) {
    ops.push({ col: 'config', id: 'app', data: parsed.config });
  }
  for (const c of parsed.categories) ops.push({ col: 'categories', id: c.id, data: c });
  for (const p of parsed.predicates) ops.push({ col: 'predicates', id: p.id, data: p });
  for (const o of parsed.options) ops.push({ col: 'options', id: o.id, data: o });
  for (const s of parsed.subjects) ops.push({ col: 'subjects', id: s.id, data: s });

  const mediaList = Array.isArray(parsed.media) ? parsed.media : [];
  for (const m of mediaList) {
    if (m.dataUrl && getUtf8ByteLength(m.dataUrl) < MAX_MEDIA_BYTES) {
      ops.push({ col: 'media', id: m.id, data: m });
    }
  }

  // Escribir en lotes seguros de máximo 350 documentos por batch
  const BATCH_SIZE = 350;
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const slice = ops.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const op of slice) {
      batch.set(doc(db, op.col, op.id), op.data);
    }
    await batch.commit();
  }

  for (const m of mediaList) {
    await cacheMediaLocally(m);
  }

  return {
    categories: parsed.categories.length,
    predicates: parsed.predicates.length,
    options: parsed.options.length,
    subjects: parsed.subjects.length,
    media: mediaList.length,
  };
}
