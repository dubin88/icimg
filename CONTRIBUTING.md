# Contributing

Thanks for helping improve iCImg.

```sh
git clone https://github.com/dubin88/icimg.git
cd icimg
npm ci
npx playwright install chromium
npm run dev
```

Before opening a pull request, run `npm run test:all`. Module tests load ESM, CommonJS, RequireJS AMD and global/UMD builds. Browser tests cover the editor, language switching, shapes and curves.

- Keep the runtime dependency-free and compatible with modern browsers.
- Add meaningful regression tests for new behavior.
- Keep editor text in the locale dictionaries. Every locale must contain the same keys.
- Preserve image-space annotation coordinates independently of crop and preview zoom.
- Describe the user-visible behavior and relevant validation in your pull request.

Report bugs through [GitHub Issues](https://github.com/dubin88/icimg/issues), including browser version, reproduction steps and a small image example when useful. Do not post credentials or private images.
