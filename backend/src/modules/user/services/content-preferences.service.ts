import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';
import { userContentPreferences } from '../../../database/schema/index.js';
import type { UpsertContentPreferencesDto } from '../dto/content-preferences.dto.js';

const DEFAULT_PREFERENCES = {
  hideNsfw: true,
  excludedTypes: [] as string[],
  excludedDemographics: [] as string[],
  excludedGenreSlugs: [] as string[],
  highlightedGenreSlugs: [] as string[],
};

@Injectable()
export class ContentPreferencesService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getByUserId(userId: number) {
    const prefs = await this.db.query.userContentPreferences.findFirst({
      where: eq(userContentPreferences.userId, userId),
    });
    return prefs ?? { userId, ...DEFAULT_PREFERENCES };
  }

  async upsert(userId: number, dto: UpsertContentPreferencesDto) {
    const values = {
      userId,
      hideNsfw: dto.hideNsfw ?? DEFAULT_PREFERENCES.hideNsfw,
      excludedTypes: dto.excludedTypes ?? DEFAULT_PREFERENCES.excludedTypes,
      excludedDemographics:
        dto.excludedDemographics ?? DEFAULT_PREFERENCES.excludedDemographics,
      excludedGenreSlugs:
        dto.excludedGenreSlugs ?? DEFAULT_PREFERENCES.excludedGenreSlugs,
      highlightedGenreSlugs:
        dto.highlightedGenreSlugs ?? DEFAULT_PREFERENCES.highlightedGenreSlugs,
      updatedAt: new Date(),
    };

    const [result] = await this.db
      .insert(userContentPreferences)
      .values(values)
      .onConflictDoUpdate({
        target: userContentPreferences.userId,
        set: {
          hideNsfw: values.hideNsfw,
          excludedTypes: values.excludedTypes,
          excludedDemographics: values.excludedDemographics,
          excludedGenreSlugs: values.excludedGenreSlugs,
          highlightedGenreSlugs: values.highlightedGenreSlugs,
          updatedAt: values.updatedAt,
        },
      })
      .returning();

    return result;
  }
}
