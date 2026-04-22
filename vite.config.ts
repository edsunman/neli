import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import mkcert from 'vite-plugin-mkcert';
import { defineConfig, type PluginOption } from 'vite';

export default defineConfig({
	server: {
		host: '127.0.0.1',
		allowedHosts: ['app.local.test', 'local.test'],
		port: 5173,
		strictPort: true
	},
	plugins: [tailwindcss() as PluginOption[], sveltekit(), mkcert()],
	define: { __VERSION__: JSON.stringify(process.env.npm_package_version) }
});
