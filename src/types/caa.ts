export type FitzgeraldColor = 'orange' | 'yellow' | 'green' | 'blue' | 'purple';

export type OptionType = 'food' | 'sound' | 'color' | 'habitat' | 'action' | 'object';

export interface AppConfig {
  visibleCategoryIds: string[];
  showAllPredicatesMode: boolean;
  optionsPerRound: 3 | 4;
  visualPromptDimDistractors?: boolean;
  holdBackButtonInActivity?: boolean;
}

export interface CategoryDoc {
  id: string;
  name: string;
  emojiFallback?: string;
  fitzgeraldColor?: FitzgeraldColor;
  imageMediaId: string | null;
  audioMediaId: string | null;
  order: number;
  active: boolean;
}

export interface PredicateDoc {
  id: string;
  label: string;
  questionPrompt: string;
  optionType: OptionType;
  fitzgeraldColor: 'green';
  emojiFallback?: string;
  imageMediaId: string | null;
  audioMediaId: string | null;
  order: number;
}

export interface OptionDoc {
  id: string;
  label: string;
  /** Texto opcional para concordancia natural en frase (ej. label: "selva", spokenLabel: "la selva") */
  spokenLabel?: string;
  optionType: OptionType;
  fitzgeraldColor: FitzgeraldColor;
  emojiFallback?: string;
  imageMediaId: string | null;
  audioMediaId: string | null;
}

export interface SubjectRelation {
  targetOptionIds: string[];
  customPhraseOverride?: string;
}

export interface SubjectDoc {
  id: string;
  categoryId: string;
  article: string;
  name: string;
  fitzgeraldColor?: FitzgeraldColor;
  emojiFallback?: string;
  imageMediaId: string | null;
  audioMediaId: string | null;
  soundEffectMediaId?: string | null;
  order: number;
  active: boolean;
  relations: Record<string, SubjectRelation>;
}

export interface MediaDoc {
  id: string;
  kind: 'image' | 'audio';
  mimeType: string;
  dataUrl: string;
  sizeBytes: number;
  createdAt: number;
}

export interface BackupPayload {
  version: number;
  exportedAt: string;
  config: AppConfig;
  categories: CategoryDoc[];
  predicates: PredicateDoc[];
  options: OptionDoc[];
  subjects: SubjectDoc[];
  media: MediaDoc[];
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  visibleCategoryIds: [],
  showAllPredicatesMode: false,
  optionsPerRound: 3,
  visualPromptDimDistractors: false,
  holdBackButtonInActivity: false,
};

export const OPTION_TYPE_LABELS: Record<OptionType, string> = {
  food: 'Comida',
  sound: 'Sonido',
  color: 'Color',
  habitat: 'Hábitat / Lugar',
  action: 'Acción',
  object: 'Objeto',
};

export const DEFAULT_COLOR_BY_OPTION_TYPE: Record<OptionType, FitzgeraldColor> = {
  food: 'orange',
  object: 'orange',
  sound: 'green',
  action: 'green',
  color: 'blue',
  habitat: 'purple',
};
