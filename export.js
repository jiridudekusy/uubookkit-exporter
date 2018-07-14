const {Uri, UriBuilder} = require("uu_appg01_core-uri");
const {AppClient} = require("uu_appg01_server-client");
const {LoggerFactory} = require("uu_appg01_core-logging");
const {Config} = require("uu_appg01_core-utils");

const fs = require('fs');
let mkdirp = require('mkdirp');
const {promisify} = require('util');
const path = require('path');
const DOMParser = require("xmldom-uu5").DOMParser;
const downloadUuBmlDraw = require("./draw");

const writefile = promisify(fs.writeFile);
mkdirp = promisify(mkdirp);

Config.activateProfiles("development");
const logger = LoggerFactory.get("exporter");

let _downloadUuBmlDraws, _downloadBinaries;

const defaultOptions = {
  /**
   * Exports all UuBmlDraws used in book content.
   */
  exportDraws: false,
  /**
   * Exports all Binaries used in book content.
   */
  exportBinaries: false
}

/**
 * Exports book source to specified directory.
 * @param book url of book to export (it can be url to any page/usecase in book)
 * @param token authentication token to use
 * @param outputDir target output dir. It will be created if ot does not exists.
 * @param options object with export options. See defaultOptions for possible configuration.
 * @returns {Promise<void>}
 */
async function exportBook(book, token, outputDir, options) {
  options = {
    ...defaultOptions,
    ...options
  };
  logger.info(`Going to export book ${book}`);
  logger.info(`Using options : ${JSON.stringify(options)}`);

  let bookuri = UriBuilder.parse(book).clearParameters().setUseCase("").toUri();
  await mkdirp(outputDir);
  let pagesDir = path.join(outputDir, "pages");
  await mkdirp(pagesDir);

  let httpOptions = {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };

  const loadBookresponse = await AppClient.get(bookuri.toString() + "/loadBook", {}, httpOptions);
  await writefile(path.join(outputDir, "book.json"), JSON.stringify(loadBookresponse.data, null, 2), "utf8");

  const listPagesResponse = await AppClient.get(bookuri.toString() + "/listPages", {}, httpOptions);
  const pages = listPagesResponse.data.itemList;
  let otherResources = {
    binaries: new Set([]),
    draws: new Set([])
  }
  for (const page of pages) {
    const pageDataResponse = await AppClient.get(bookuri.toString() + "/loadPage", {code: page.code}, httpOptions);
    const pageData = pageDataResponse.data;
    _analyzePage(pageData, otherResources, options);
    const fileName = `${page.code}.json`;
    await writefile(path.join(pagesDir, fileName), JSON.stringify(pageData, null, 2), "utf8");
  }

  await _downloadUuBmlDraws(outputDir, otherResources.draws, httpOptions);
  await _downloadBinaries(outputDir, otherResources.binaries, bookuri, httpOptions);

}

/**
 * Helper method to download all used uubml draws.
 * @param outputDir main output dir
 * @param draws set of UuBmlDraw codes to download
 * @param httpOptions options for AppClient
 * @returns {Promise<void>}
 * @private
 */
_downloadUuBmlDraws = async function _downloadUuBmlDraws(outputDir, draws, httpOptions) {
  let drawsDir = path.join(outputDir, "draws");
  await mkdirp(drawsDir);
  for (let draw of draws) {
    try {
      logger.info(`Downloading UuBmlDraw ${draw}.`);
      await downloadUuBmlDraw(draw, httpOptions, drawsDir);
    } catch (e) {
      logger.error(`UuBmlDraw ${draw} cannot be downloaded.`, e);
    }
  }
}

/**
 * Helper method to download all used binries.
 * @param outputDir main output dir
 * @param binaries set of binary codes to download
 * @param bookuri root uri of book
 * @param httpOptions options for AppClient
 * @returns {Promise<void>}
 * @private
 */
_downloadBinaries = async function _downloadBinaries(outputDir, binaries, bookuri, httpOptions) {
  let binariesDir = path.join(outputDir, "binaries");
  await mkdirp(binariesDir);
  for (let binary of binaries) {
    logger.info(`Downloading binary ${binary}.`);
    try {
      let uri = UriBuilder.parse(bookuri).setUseCase("getBinaryData").setParameter("code", binary).toUri();
      let response = await AppClient.get(uri, null, httpOptions);
      let binaryPath = path.join(binariesDir, binary);
      await response.data.pipe(fs.createWriteStream(binaryPath));
    } catch (e) {
      if (e.code === "uu-app-binarystore/uuBinaryGetBinaryData/uuBinaryDoesNotExist") {
        logger.warn(`Binary ${binary} does not exist.`);
      } else {
        logger.error(`Binary ${binary} cannot be downloaded.`, e);
      }
    }
  }
}

function _processNode(node, ctx, options) {
  //TODO provide configurable settings
  if (options.exportBinaries) {
    if (node.nodeName === "UuApp.DesignKit.UU5ComponentExample") {
      if (node.hasAttribute("srcUuBinaryCode")) {
        let binary = node.getAttribute("srcUuBinaryCode");
        logger.info(`Found binary UuApp.DesignKit.UU5ComponentExample "${binary}".`)
        ctx.binaries.add(binary);
      }
    }
  }
  if (options.exportDraws) {
    if (node.nodeName === "Plus4U5.UuBmlDraw.Image") {
      if (node.hasAttribute("code")) {
        let draw = node.getAttribute("code");
        logger.info(`Found Plus4U5.UuBmlDraw.Image "${draw}".`)
        ctx.draws.add(draw);
      }
    }
  }

  Array.prototype.filter
  .call(node.childNodes, node => node.nodeType === 1)
  .forEach(node => _processNode(node, ctx, options))
}

function _analyzePage(page, ctx, options) {
  logger.info(`Analyzing page ${page.code} for other resoureces.`)
  let body = page.body;
  if (typeof body === "string") {
    body = [body]
  }
  body.forEach(part => {
    let parser = new DOMParser();
    if (part.startsWith("<uu5string/>")) {
      part = "<root>" + part + "</root>";
      let dom = parser.parseFromString(part);
      Array.prototype.filter
      .call(dom.documentElement.childNodes, node => node.nodeType === 1)
      .filter(node => node.nodeName != "uu5string")
      .forEach(node => _processNode(node, ctx, options))
    }
  });
}

module.exports = exportBook;