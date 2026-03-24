export interface ContentPreferences {
  hideNsfw: boolean;
  excludedTypes: string[];
  excludedDemographics: string[];
  excludedGenreSlugs: string[];
  highlightedGenreSlugs: string[];
}

export const DEFAULT_PREFERENCES: ContentPreferences = {
  hideNsfw: true,
  excludedTypes: [],
  excludedDemographics: [],
  excludedGenreSlugs: [],
  highlightedGenreSlugs: [],
};
