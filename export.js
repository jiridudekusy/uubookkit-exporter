const {Uri, UriBuilder} = require("uu_appg01_core-uri");
const {AppClient} = require("uu_appg01_server-client");
const {LoggerFactory} = require("uu_appg01_core-logging");
const {Config} = require("uu_appg01_core-utils");
const DefaultConfig = require("./config/default");
const pjson = require('./package.json');

const fs = require('fs');
let mkdirp = require('mkdirp');
const {promisify} = require('util');
const path = require('path');
const DOMParser = require("xmldom-uu5").DOMParser;
const downloadUuBmlDraw2 = require("./draw-g02");
const downloadUuBmlDraw3 = require("./draw-g03");

const {UU5ToMarkdown} = require("uu5-to-markdown");
const {UuBookKitPlugin, UU5CodeKitConverters, UuAppDesignKitConverters} = require("uu5-to-markdown");
const {UuBookKitToMarkdown} = require("uu5-to-markdown");

const writefile = promisify(fs.writeFile);
mkdirp = promisify(mkdirp);

Config.activeProfiles = "development";
Config.registerImplicitSource(DefaultConfig);
const logger = LoggerFactory.get("exporter");

const uu5toMarkdown = new UU5ToMarkdown(new UU5CodeKitConverters(), new UuBookKitPlugin(), new UuAppDesignKitConverters());
const uuBookKitToMarkdown = new UuBookKitToMarkdown(uu5toMarkdown);

let _downloadUuBmlDraws, _downloadBinaries;

const defaultOptions = {
  /**
   * Exports all UuBmlDraws used in book content.
   */
  exportDraws: false,
  /**
   * Exports all Binaries used in book content.
   */
  exportBinaries: false,
  /**
   * Transforms page body to formatted uu5string and stores it to another file.
   */
  transformBody: false,
  /**
   * Transform page body to markdown.
   */
  markdown: false
};

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

  let exportDescriptor = {
    book,
    options: options,
    exportStart: new Date(),
    stats: {},
    version: pjson.version
  };

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
  };
  let pagesStats = {
    exported: 0,
    error: 0
  };
  for (const page of pages) {
    try {
      const pageDataResponse = await AppClient.get(bookuri.toString() + "/loadPage", {code: page.code}, httpOptions);
      const pageData = pageDataResponse.data;
      _analyzePage(pageData, otherResources, options);
      const fileName = `${page.code}.json`;
      await writefile(path.join(pagesDir, fileName), JSON.stringify(pageData, null, 2), "utf8");
      if (options.transformBody) {
        let body = pageData.body;
        if (!Array.isArray(body)) {
          body = [body];
        }
        let transformedBody = body
        .map(part => part.content.startsWith("<uu5string/>") ? part.content.substring("<uu5string/>".length) : part.content)
        .join("\n\n<div hidden>Part end(uu5string does not support comments)</div>\n\n");
        transformedBody = "<uu5string/>\n" + transformedBody;
        await writefile(path.join(pagesDir, `${page.code}.uu5`), transformedBody, "utf8");
        pagesStats.exported++;
      }
      if (options.markdown) {
        let md = await _transformToMD(pageData);
        await writefile(path.join(pagesDir, `${page.code}.md`), md, "utf8");
      }
    } catch (e) {
      pagesStats.error++;
      logger.error(`Page ${page.code} cannot be downloaded.`, e);
    }
  }
  exportDescriptor.stats.pages = pagesStats;
  exportDescriptor.stats.draws = await _downloadUuBmlDraws(outputDir, otherResources.draws, bookuri, httpOptions);
  exportDescriptor.stats.binaries = await _downloadBinaries(outputDir, otherResources.binaries, bookuri, httpOptions);

  exportDescriptor.exportEnd = new Date();
  exportDescriptor.stats.duration = exportDescriptor.exportEnd - exportDescriptor.exportStart;

  await writefile(path.join(outputDir, "export-result.json"), JSON.stringify(exportDescriptor, null, 2), "utf8");
  logger.info("Export has been finished. See export statistics bellow.");
  console.log(JSON.stringify(exportDescriptor, null, 2));
}

_transformToMD = async function _transformToMD(pageData) {
  return await uuBookKitToMarkdown.toMarkdown(JSON.stringify(pageData));
}

/**
 * Helper method to download all used uubml draws.
 * @param outputDir main output dir
 * @param draws set of UuBmlDraw codes to download
 * @param httpOptions options for AppClient
 * @returns {Promise<void>}
 * @private
 */
_downloadUuBmlDraws = async function _downloadUuBmlDraws(outputDir, draws, bookuri, httpOptions) {
  let stats = {
    exported: 0,
    error: 0
  };
  let drawsDir = path.join(outputDir, "draws");
  await mkdirp(drawsDir);
  for (let draw of draws) {
    try {
      logger.info(`Downloading UuBmlDraw ${draw.code}.`);
      if (draw.version === 2) {
        await downloadUuBmlDraw2(draw.code, httpOptions, drawsDir);
      } else {
        await downloadUuBmlDraw3(draw.code, bookuri, httpOptions, drawsDir);
      }
      stats.exported++;
    } catch (e) {
      stats.error++;
      logger.error(`UuBmlDraw ${draw.code} cannot be downloaded.`, e);
    }
  }
  return stats;
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
  let stats = {
    exported: 0,
    notFound: 0,
    error: 0
  };
  let binariesDir = path.join(outputDir, "binaries");
  await mkdirp(binariesDir);
  for (let binary of binaries) {
    logger.info(`Downloading binary ${binary}.`);
    try {
      let uri = UriBuilder.parse(bookuri).setUseCase("getBinaryData").setParameter("code", binary).toUri();
      let response = await AppClient.get(uri, null, httpOptions);
      let binaryPath = path.join(binariesDir, binary);
      await response.data.pipe(fs.createWriteStream(binaryPath));
      stats.exported++;
    } catch (e) {
      if (e.code === "uu-app-binarystore/uuBinaryGetBinaryData/uuBinaryDoesNotExist") {
        stats.notFound++;
        logger.warn(`Binary ${binary} does not exist.`);
      } else {
        stats.error++;
        logger.error(`Binary ${binary} cannot be downloaded.`, e);
      }
    }
  }
  return stats;
}

function _processNode(node, ctx, options) {
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
        ctx.draws.add({code: draw, version: 2});
      }
    }
    if (node.nodeName === "UuBmlDraw.Imaging.Image") {
      if (node.hasAttribute("code")) {
        let draw = node.getAttribute("code");
        logger.info(`Found UuBmlDraw.Imaging.Image "${draw}".`)
        ctx.draws.add({code: draw, version: 3});
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
  body.forEach(part => {
    let parser = new DOMParser();
    let content = part.content;
    if (content.startsWith("<uu5string/>")) {
      content = "<root>" + content + "</root>";
      let dom = parser.parseFromString(content);
      Array.prototype.filter
      .call(dom.documentElement.childNodes, node => node.nodeType === 1)
      .filter(node => node.nodeName != "uu5string")
      .forEach(node => _processNode(node, ctx, options))
    }
  });
}

module.exports = exportBook;