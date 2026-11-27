import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import {
  deleteMediaIfUnreferenced,
  getOfflineCacheCoverage,
  prefetchMissingMedia,
  type OfflineMediaStatus,
} from '../lib/mediaCache';
import { evictDecodedAudio } from '../lib/speechEngine';
import {
  DEFAULT_APP_CONFIG,
  type AppConfig,
  type CategoryDoc,
  type OptionDoc,
  type PredicateDoc,
  type SubjectDoc,
} from '../types/caa';

interface CaaDataContextValue {
  config: AppConfig;
  categories: CategoryDoc[];
  predicates: PredicateDoc[];
  options: OptionDoc[];
  subjects: SubjectDoc[];
  loading: boolean;
  offlineStatus: OfflineMediaStatus & { syncing: boolean };
  syncAllOfflineMedia: () => Promise<OfflineMediaStatus>;
  saveConfig: (next: AppConfig) => Promise<void>;
  saveCategory: (cat: CategoryDoc, removedMediaIds?: string[]) => Promise<void>;
  deleteCategory: (cat: CategoryDoc) => Promise<void>;
  savePredicate: (pred: PredicateDoc, removedMediaIds?: string[]) => Promise<void>;
  deletePredicate: (pred: PredicateDoc) => Promise<void>;
  saveOption: (opt: OptionDoc, removedMediaIds?: string[]) => Promise<void>;
  deleteOption: (opt: OptionDoc) => Promise<void>;
  saveSubject: (subj: SubjectDoc, removedMediaIds?: string[]) => Promise<void>;
  deleteSubject: (subj: SubjectDoc) => Promise<void>;
}

const CaaDataContext = createContext<CaaDataContextValue | null>(null);

function collectReferencedMediaIds(params: {
  categories: CategoryDoc[];
  predicates: PredicateDoc[];
  options: OptionDoc[];
  subjects: SubjectDoc[];
}): Set<string> {
  const refs = new Set<string>();
  for (const c of params.categories) {
    if (c.imageMediaId) refs.add(c.imageMediaId);
    if (c.audioMediaId) refs.add(c.audioMediaId);
  }
  for (const p of params.predicates) {
    if (p.imageMediaId) refs.add(p.imageMediaId);
    if (p.audioMediaId) refs.add(p.audioMediaId);
  }
  for (const o of params.options) {
    if (o.imageMediaId) refs.add(o.imageMediaId);
    if (o.audioMediaId) refs.add(o.audioMediaId);
  }
  for (const s of params.subjects) {
    if (s.imageMediaId) refs.add(s.imageMediaId);
    if (s.audioMediaId) refs.add(s.audioMediaId);
    if (s.soundEffectMediaId) refs.add(s.soundEffectMediaId);
  }
  return refs;
}

export function CaaDataProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [predicates, setPredicates] = useState<PredicateDoc[]>([]);
  const [options, setOptions] = useState<OptionDoc[]>([]);
  const [subjects, setSubjects] = useState<SubjectDoc[]>([]);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  const [offlineStatus, setOfflineStatus] = useState<OfflineMediaStatus & { syncing: boolean }>({
    total: 0,
    cached: 0,
    newlyFetched: 0,
    syncing: false,
  });

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    let loadedParts = 0;
    const markLoaded = () => {
      loadedParts++;
      if (loadedParts >= 5) setLoading(false);
    };

    const unsubConfig = onSnapshot(
      doc(db, 'config', 'app'),
      (snap) => {
        if (snap.exists()) {
          setConfig({ ...DEFAULT_APP_CONFIG, ...(snap.data() as Partial<AppConfig>) });
        } else {
          setConfig(DEFAULT_APP_CONFIG);
        }
        markLoaded();
      },
      () => markLoaded(),
    );

    const unsubCategories = onSnapshot(
      collection(db, 'categories'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ ...(d.data() as Omit<CategoryDoc, 'id'>), id: d.id }))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setCategories(list);
        markLoaded();
      },
      () => markLoaded(),
    );

    const unsubPredicates = onSnapshot(
      collection(db, 'predicates'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ ...(d.data() as Omit<PredicateDoc, 'id'>), id: d.id }))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setPredicates(list);
        markLoaded();
      },
      () => markLoaded(),
    );

    const unsubOptions = onSnapshot(
      collection(db, 'options'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ ...(d.data() as Omit<OptionDoc, 'id'>), id: d.id }))
          .sort((a, b) => a.label.localeCompare(b.label, 'es'));
        setOptions(list);
        markLoaded();
      },
      () => markLoaded(),
    );

    const unsubSubjects = onSnapshot(
      collection(db, 'subjects'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ ...(d.data() as Omit<SubjectDoc, 'id'>), id: d.id }))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setSubjects(list);
        markLoaded();
      },
      () => markLoaded(),
    );

    return () => {
      unsubConfig();
      unsubCategories();
      unsubPredicates();
      unsubOptions();
      unsubSubjects();
    };
  }, []);

  const allMediaIds = useMemo(
    () =>
      Array.from(
        collectReferencedMediaIds({ categories, predicates, options, subjects }),
      ),
    [categories, predicates, options, subjects],
  );

  // Sincronización preventiva silenciosa 100% offline en IndexedDB
  const syncAllOfflineMedia = useCallback(async (): Promise<OfflineMediaStatus> => {
    setOfflineStatus((prev) => ({ ...prev, syncing: true }));
    const res = await prefetchMissingMedia(allMediaIds, (progress) => {
      setOfflineStatus({ ...progress, syncing: true });
    });
    setOfflineStatus({ ...res, syncing: false });
    return res;
  }, [allMediaIds]);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;

    const run = async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await syncAllOfflineMedia();
      } else {
        const cov = await getOfflineCacheCoverage(allMediaIds);
        if (!cancelled) {
          setOfflineStatus({ total: cov.total, cached: cov.cached, newlyFetched: 0, syncing: false });
        }
      }
    };
    run().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [loading, allMediaIds, syncAllOfflineMedia]);

  const cleanupOrphans = useCallback(
    async (
      candidateIds: Array<string | null | undefined>,
      overrideState: {
        categories?: CategoryDoc[];
        predicates?: PredicateDoc[];
        options?: OptionDoc[];
        subjects?: SubjectDoc[];
      },
    ) => {
      const uniqueCandidates = Array.from(
        new Set(candidateIds.filter((x): x is string => Boolean(x))),
      );
      if (uniqueCandidates.length === 0) return;

      const stillReferenced = collectReferencedMediaIds({
        categories: overrideState.categories ?? categories,
        predicates: overrideState.predicates ?? predicates,
        options: overrideState.options ?? options,
        subjects: overrideState.subjects ?? subjects,
      });

      for (const mediaId of uniqueCandidates) {
        await deleteMediaIfUnreferenced(mediaId, stillReferenced, evictDecodedAudio);
      }
    },
    [categories, predicates, options, subjects],
  );

  const requireDb = () => {
    if (!db) throw new Error('Firebase no está configurado.');
    return db;
  };

  const saveConfig = async (next: AppConfig) => {
    await setDoc(doc(requireDb(), 'config', 'app'), next, { merge: true });
  };

  const saveCategory = async (cat: CategoryDoc, removedMediaIds: string[] = []) => {
    await setDoc(doc(requireDb(), 'categories', cat.id), cat);
    const nextList = [...categories.filter((c) => c.id !== cat.id), cat];
    await cleanupOrphans(removedMediaIds, { categories: nextList });
  };

  const deleteCategory = async (cat: CategoryDoc) => {
    await deleteDoc(doc(requireDb(), 'categories', cat.id));
    const nextList = categories.filter((c) => c.id !== cat.id);
    await cleanupOrphans([cat.imageMediaId, cat.audioMediaId], { categories: nextList });
  };

  const savePredicate = async (pred: PredicateDoc, removedMediaIds: string[] = []) => {
    await setDoc(doc(requireDb(), 'predicates', pred.id), pred);
    const nextList = [...predicates.filter((p) => p.id !== pred.id), pred];
    await cleanupOrphans(removedMediaIds, { predicates: nextList });
  };

  const deletePredicate = async (pred: PredicateDoc) => {
    await deleteDoc(doc(requireDb(), 'predicates', pred.id));
    const nextList = predicates.filter((p) => p.id !== pred.id);
    await cleanupOrphans([pred.imageMediaId, pred.audioMediaId], { predicates: nextList });
  };

  const saveOption = async (opt: OptionDoc, removedMediaIds: string[] = []) => {
    await setDoc(doc(requireDb(), 'options', opt.id), opt);
    const nextList = [...options.filter((o) => o.id !== opt.id), opt];
    await cleanupOrphans(removedMediaIds, { options: nextList });
  };

  const deleteOption = async (opt: OptionDoc) => {
    await deleteDoc(doc(requireDb(), 'options', opt.id));
    const nextList = options.filter((o) => o.id !== opt.id);
    await cleanupOrphans([opt.imageMediaId, opt.audioMediaId], { options: nextList });
  };

  const saveSubject = async (subj: SubjectDoc, removedMediaIds: string[] = []) => {
    await setDoc(doc(requireDb(), 'subjects', subj.id), subj);
    const nextList = [...subjects.filter((s) => s.id !== subj.id), subj];
    await cleanupOrphans(removedMediaIds, { subjects: nextList });
  };

  const deleteSubject = async (subj: SubjectDoc) => {
    await deleteDoc(doc(requireDb(), 'subjects', subj.id));
    const nextList = subjects.filter((s) => s.id !== subj.id);
    await cleanupOrphans(
      [subj.imageMediaId, subj.audioMediaId, subj.soundEffectMediaId],
      { subjects: nextList },
    );
  };

  return (
    <CaaDataContext.Provider
      value={{
        config,
        categories,
        predicates,
        options,
        subjects,
        loading,
        offlineStatus,
        syncAllOfflineMedia,
        saveConfig,
        saveCategory,
        deleteCategory,
        savePredicate,
        deletePredicate,
        saveOption,
        deleteOption,
        saveSubject,
        deleteSubject,
      }}
    >
      {children}
    </CaaDataContext.Provider>
  );
}

export function useCaaData(): CaaDataContextValue {
  const ctx = useContext(CaaDataContext);
  if (!ctx) throw new Error('useCaaData debe usarse dentro de CaaDataProvider');
  return ctx;
}
