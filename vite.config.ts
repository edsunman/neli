import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
//import mkcert from 'vite-plugin-mkcert';
import { defineConfig, type PluginOption } from 'vite';

export default defineConfig({
	plugins: [tailwindcss() as PluginOption[], sveltekit() /*  myPlugin() ,  mkcert()*/],
	define: { __VERSION__: JSON.stringify(process.env.npm_package_version) }
});
