import { ValueTransformer } from 'typeorm';

export class ColumnNumericTransformer implements ValueTransformer {
  to(data: number | null | undefined): number | null | undefined {
    return data;
  }

  from(data: string | null | undefined): number | null {
    if (data === null || data === undefined) {
      return null;
    }
    const res = parseFloat(data);
    return isNaN(res) ? null : res;
  }
}

