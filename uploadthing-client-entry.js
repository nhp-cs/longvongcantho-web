import { genUploader } from 'uploadthing/client';

const { uploadFiles } = genUploader({
  url: `${window.location.origin}/api/uploadthing`,
  fetch: (input, init) => {
    const target = new URL(input instanceof Request ? input.url : input, window.location.href);
    return fetch(input, {
      ...init,
      credentials: target.origin === window.location.origin ? 'include' : 'omit',
    });
  },
});

export { uploadFiles };
