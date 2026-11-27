const STORAGE_KEY = 'caa_last_predicate_by_subject_v1';

function readMap(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, string>;
    }
    return {};
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, string>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Modo privado o cuota llena: fallar en silencio
  }
}

/**
 * Devuelve el siguiente predicado disponible para un sujeto respecto al último usado,
 * implementando la rotación inteligente anti-aburrimiento.
 */
export function getNextRotatedPredicateId(
  subjectId: string,
  availablePredicateIds: string[],
): string | null {
  if (availablePredicateIds.length === 0) return null;
  if (availablePredicateIds.length === 1) return availablePredicateIds[0];

  const map = readMap();
  const lastPredicateId = map[subjectId];
  if (!lastPredicateId) {
    return availablePredicateIds[0];
  }

  const lastIndex = availablePredicateIds.indexOf(lastPredicateId);
  if (lastIndex === -1) {
    return availablePredicateIds[0];
  }

  const nextIndex = (lastIndex + 1) % availablePredicateIds.length;
  return availablePredicateIds[nextIndex];
}

export function saveLastPredicateForSubject(subjectId: string, predicateId: string): void {
  const map = readMap();
  map[subjectId] = predicateId;
  writeMap(map);
}
