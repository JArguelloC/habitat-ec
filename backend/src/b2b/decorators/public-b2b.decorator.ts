import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_B2B_KEY = 'isPublicB2b';
export const PublicB2b = () => SetMetadata(IS_PUBLIC_B2B_KEY, true);

