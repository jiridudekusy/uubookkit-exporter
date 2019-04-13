const buildUrl = require('build-url');
const {LoggerFactory} = require("uu_appg01_core-logging");
const fs = require("fs");
const path = require('path');
const {AppClient} = require("uu_appg01_server-client");

const logger = LoggerFactory.get("exporter.draw");
const imageSourceRE = /src="(.*?)"/;

async function downloadUuBmlDraw(code, httpOptions, output) {
  let url = buildUrl('https://widget.plus4u.net', {
    path: 'VPH-BT/uu-uubmldraw/getContent',
    queryParams: {
      referrerUri: "ues:VPH-BT[29537617]:UUAPPKNH/PORTAL[44191581396036005]:50946987294721227[50946987294721227]",
      uuid: code,
      uuAT: httpOptions.headers.Authorization,
      readOnly: true
    }
  });
  let response = await AppClient.get(url, null, httpOptions);
  let html = response.data
  let result = imageSourceRE.exec(html);
  if (result) {
    let downloadUrl = result[1];
    logger.info(`UuBmlDraw ${code} will be downloaded from ${downloadUrl}`);
    let imageResp = await AppClient.get(downloadUrl, null, {transformResponse: false, ...httpOptions});
    let imageFile = path.join(output, code + ".png");
    await imageResp.data.pipe(fs.createWriteStream(imageFile));
  } else {
    logger.error(`Cannot fing download url for image ${code}`);
  }
}

module.exports = downloadUuBmlDraw;