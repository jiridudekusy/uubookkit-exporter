const {LoggerFactory} = require("uu_appg01_core-logging");
const fs = require("fs");
const path = require('path');
const {AppClient} = require("uu_appg01_server-client");
const {Uri, UriBuilder} = require("uu_appg01_core-uri");

const logger = LoggerFactory.get("exporter.draw");

async function downloadUuBmlDraw(code, bookuri, httpOptions, output) {
  let uri = UriBuilder.parse(bookuri).setUseCase("uu-uubmldraw/loadDiagram").setParameter("code", code).toUri();
  let response = await AppClient.post(uri, null, httpOptions);
  let downloadUrl = response.data.imgUrl;
  logger.info(`UuBmlDraw ${code} will be downloaded from ${downloadUrl}`);
  let imageResp = await AppClient.get(downloadUrl, null, {transformResponse: false, ...httpOptions});
  let imageFile = path.join(output, code + ".png");
  await imageResp.data.pipe(fs.createWriteStream(imageFile));
}
module.exports = downloadUuBmlDraw;