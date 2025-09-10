<p align="center">
  <h1 align="center">neli</h1>
</p>

Neli is a simple video editing web application designed and developed with speed and ease of use in mind.
It is currently early in development, with many fixes and features [planned](https://neli.video/docs) before the first stable release.

Neli is a [Svelte](https://github.com/sveltejs/svelte) app and uses [Tailwind](https://github.com/tailwindlabs/tailwindcss) for styling,
[Bits UI](https://github.com/huntabyte/bits-ui) as a base for UI components and
[Mediabunny](https://github.com/Vanilagy/mediabunny) for muxing/de-muxing video files.

### Feedback

I built Neli primarily as a learning opportunity to get a better grasp of WebGPU and WebCodecs.

If you use the app or would like to contribute, I'd love to hear your thoughts!
Please feel free to open an issue to report any problems or suggest new ideas.

### Local Developing

Neli is a [SvelteKit](https://github.com/sveltejs/kit) project using `adapter-static` to build the app as a set of static files.
Once you've cloned the project and installed dependencies with `pnpm install`, start a development server:

```bash
pnpm dev
```
