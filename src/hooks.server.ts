import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	event.setHeaders({
		'cross-origin-embedder-policy': 'require-corp',
		'cross-origin-opener-policy': 'same-origin'
	});
	return resolve(event);
};
