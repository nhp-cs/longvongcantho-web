const express = require('express');
const { createUploadthing, createRouteHandler } = require('uploadthing/express');
const { UploadThingError } = require('uploadthing/server');
const { isAdminRequest } = require('../lib/admin-auth');

const f = createUploadthing();
const router = {
  listingMedia: f({
    image: { maxFileSize: '2MB', maxFileCount: 8 },
    video: { maxFileSize: '16MB', maxFileCount: 1 },
  })
    .middleware(({ req }) => {
      if (!isAdminRequest(req)) throw new UploadThingError('Bạn cần đăng nhập quản trị để tải tệp lên.');
      return { admin: true };
    })
    .onUploadComplete(({ file }) => ({ url: file.ufsUrl })),
};

const app = express();
app.use('/api/uploadthing', createRouteHandler({ router }));
module.exports = (req, res) => app(req, res);
