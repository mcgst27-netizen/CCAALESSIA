import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { MediaDoc } from '../types/caa';

export const MAX_MEDIA_BYTES = 150 * 1024; // 150 KB límite estricto por documento media

const IDB_NAME = 'caa-media-cache-v1';
const IDB_STORE = 'media';

const memoryCache = new Map<string, MediaDoc>();
const inFlightReads = new Map<string, Promise<MediaDoc | null>>();

let idbPromise: Promise<IDBDatabase | null> | null = null;

function openMediaDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (idbPromise) return idbPromise;

  idbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(IDB_STORE)) {
          database.createObjectStore(IDB_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return idbPromise;
}

async function idbGet(id: string): Promise<MediaDoc | null> {
  const database = await openMediaDB();
  if (!database) return null;

  return new Promise((resolve) => {
    try {
      const tx = database.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(id);
      req.onsuccess = () => resolve((req.result as MediaDoc | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbPut(media: MediaDoc): Promise<void> {
  const database = await openMediaDB();
  if (!database) return;

  return new Promise((resolve) => {
    try {
      const tx = database.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(media);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbDelete(id: string): Promise<void> {
  const database = await openMediaDB();
  if (!database) return;

  return new Promise((resolve) => {
    try {
      const tx = database.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbGetAllKeys(): Promise<Set<string>> {
  const database = await openMediaDB();
  if (!database) return new Set(memoryCache.keys());

  return new Promise((resolve) => {
    try {
      const tx = database.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).getAllKeys();
      req.onsuccess = () => {
        const keys = new Set<string>(memoryCache.keys());
        for (const k of req.result) {
          if (typeof k === 'string') keys.add(k);
        }
        resolve(keys);
      };
      req.onerror = () => resolve(new Set(memoryCache.keys()));
    } catch {
      resolve(new Set(memoryCache.keys()));
    }
  });
}

export function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export async function getMediaById(mediaId: string | null | undefined): Promise<MediaDoc | null> {
  if (!mediaId) return null;

  const mem = memoryCache.get(mediaId);
  if (mem) return mem;

  const existingPromise = inFlightReads.get(mediaId);
  if (existingPromise) return existingPromise;

  const loader = (async (): Promise<MediaDoc | null> => {
    try {
      const local = await idbGet(mediaId);
      if (local) {
        memoryCache.set(mediaId, local);
        return local;
      }

      if (!db) return null;

      const snap = await getDoc(doc(db, 'media', mediaId));
      if (!snap.exists()) return null;

      const media = { ...(snap.data() as Omit<MediaDoc, 'id'>), id: snap.id } as MediaDoc;
      memoryCache.set(mediaId, media);
      await idbPut(media);
      return media;
    } catch {
      return null;
    } finally {
      inFlightReads.delete(mediaId);
    }
  })();

  inFlightReads.set(mediaId, loader);
  return loader;
}

export function createMediaId(kind: 'image' | 'audio'): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 12)
      : Math.random().toString(36).slice(2, 12);
  return `${kind}_${Date.now()}_${random}`;
}

export async function saveMediaDoc(params: {
  id?: string;
  kind: 'image' | 'audio';
  mimeType: string;
  dataUrl: string;
}): Promise<MediaDoc> {
  const sizeBytes = getUtf8ByteLength(params.dataUrl);
  if (sizeBytes >= MAX_MEDIA_BYTES) {
    throw new Error(
      `El archivo supera el límite permitido de 150 KB (peso actual: ${(sizeBytes / 1024).toFixed(1)} KB).`,
    );
  }

  if (!db) {
    throw new Error('Firebase no está configurado. Revisa tus variables .env.');
  }

  const media: MediaDoc = {
    id: params.id ?? createMediaId(params.kind),
    kind: params.kind,
    mimeType: params.mimeType,
    dataUrl: params.dataUrl,
    sizeBytes,
    createdAt: Date.now(),
  };

  await setDoc(doc(db, 'media', media.id), media);
  memoryCache.set(media.id, media);
  await idbPut(media);
  return media;
}

export async function cacheMediaLocally(media: MediaDoc): Promise<void> {
  memoryCache.set(media.id, media);
  await idbPut(media);
}

export async function deleteMediaIfUnreferenced(
  mediaId: string | null | undefined,
  stillReferencedIds: Set<string>,
  onEvict?: (evictedId: string) => void,
): Promise<boolean> {
  if (!mediaId) return false;
  if (stillReferencedIds.has(mediaId)) return false;

  memoryCache.delete(mediaId);
  await idbDelete(mediaId);
  onEvict?.(mediaId);

  if (db) {
    try {
      await deleteDoc(doc(db, 'media', mediaId));
    } catch {
      // Si el documento ya no existía o estamos offline, no bloquear la operación principal
    }
  }
  return true;
}

export interface OfflineMediaStatus {
  total: number;
  cached: number;
  newlyFetched: number;
}

export async function getOfflineCacheCoverage(
  mediaIds: string[],
): Promise<{ total: number; cached: number }> {
  const uniqueIds = Array.from(new Set(mediaIds.filter(Boolean)));
  if (uniqueIds.length === 0) return { total: 0, cached: 0 };

  const localKeys = await idbGetAllKeys();
  let cached = 0;
  for (const id of uniqueIds) {
    if (localKeys.has(id)) cached++;
  }
  return { total: uniqueIds.length, cached };
}

export async function prefetchMissingMedia(
  mediaIds: string[],
  onProgress?: (status: OfflineMediaStatus) => void,
): Promise<OfflineMediaStatus> {
  const uniqueIds = Array.from(new Set(mediaIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    const empty = { total: 0, cached: 0, newlyFetched: 0 };
    onProgress?.(empty);
    return empty;
  }

  const localKeys = await idbGetAllKeys();
  const missing = uniqueIds.filter((id) => !localKeys.has(id));
  let cached = uniqueIds.length - missing.length;
  let newlyFetched = 0;

  onProgress?.({ total: uniqueIds.length, cached, newlyFetched });

  if (missing.length === 0 || !db || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return { total: uniqueIds.length, cached, newlyFetched };
  }

  const CONCURRENCY = 4;
  for (let i = 0; i < missing.length; i += CONCURRENCY) {
    const batch = missing.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((id) => getMediaById(id)));
    for (const item of results) {
      if (item) {
        cached++;
        newlyFetched++;
      }
    }
    onProgress?.({ total: uniqueIds.length, cached, newlyFetched });
  }

  return { total: uniqueIds.length, cached, newlyFetched };
}
