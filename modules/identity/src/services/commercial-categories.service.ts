import { Injectable } from '@nestjs/common';
import {
  COMMERCIAL_CATEGORIES,
  type CommercialCategory,
} from '../domain/commercial-category.js';

@Injectable()
export class CommercialCategoriesService {
  findAll(): CommercialCategory[] {
    return COMMERCIAL_CATEGORIES;
  }

  findByCode(code: string): CommercialCategory {
    const cleanCode = (code || '').toUpperCase().trim();
    const category = COMMERCIAL_CATEGORIES.find((c) => c.code.toUpperCase() === cleanCode);
    if (!category) {
      const fallback = COMMERCIAL_CATEGORIES.find((c) => c.code === 'OTRO');
      return fallback || COMMERCIAL_CATEGORIES[0];
    }
    return category;
  }
}
