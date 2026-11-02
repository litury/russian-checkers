declare const __DAMKA_BUILD__: string;

export const BUILD_ID =
	typeof __DAMKA_BUILD__ === 'string' ? __DAMKA_BUILD__ : 'development';
