// parameters for the script

const {Uri, UriBuilder} = require("uu_appg01_core-uri");
const {AppClient} = require("uu_appg01_server-client");
const fs = require('fs');
let mkdirp = require('mkdirp');
const {promisify} = require('util');
const path = require('path');

const writefile = promisify(fs.writeFile);
mkdirp = promisify(mkdirp);

async function exportBook(book, token, outputDir) {

  console.log(`Going to export book ${book}`);
  let bookuri = UriBuilder.parse(book).clearParameters().setUseCase("").toUri();
  await mkdirp(outputDir);
  let pagesDir = await mkdirp(path.join(outputDir, "pages"));

  let httpOptions = {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };

  const loadBookresponse = await AppClient.get(bookuri.toString() + "/loadBook", {}, httpOptions);
  await writefile(path.join(outputDir, "book.json"), JSON.stringify(loadBookresponse.data, null, 2),"utf8");

  const listPagesResponse = await AppClient.get(bookuri.toString() + "/listPages", {}, httpOptions);
  const pages = listPagesResponse.data.itemList;
  for (const page of pages) {
    const pageDataResponse = await AppClient.get(bookuri.toString() + "/loadPage", {code: page.code}, httpOptions);
    const fileName = `${page.code}.json`;
    await writefile(path.join(pagesDir, fileName), JSON.stringify(pageDataResponse.data, null, 2),"utf8");
  }

}

module.exports = exportBook;