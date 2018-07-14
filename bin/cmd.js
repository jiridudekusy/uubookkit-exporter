#!/usr/bin/env node

let exportBook = require("../export");
const commandLineArgs = require("command-line-args");
const commandLineUsage = require("command-line-usage")

const optionDefinitions = [
  {
    name: "book",
    alias: "b",
    type: String,
    typeLabel: "{underline url}",
    description: "URL of book to export"
  },
  {
    name: "token",
    alias: "t",
    type: String,
    typeLabel: "{underline token}",
    description: "Your token from oidc.plus4u.net"
  },
  {
    name: "output",
    alias: "o",
    type: String,
    typeLabel: "{underline dir}",
    description: "Target output directory"
  },
  {
    name: "binaries",
    type: Boolean,
    description: "Export also referred binaries."
  },
  {
    name: "draws",
    type: Boolean,
    description: "Export also referred UuBml.Draws."
  },

  {
    name: "help",
    alias: "h",
    type: Boolean,
    description: "Displays this usage guide."
  },
];
const sections = [
  {
    header: "uuBookKit-exporter",
    content: "Export source JSON files for all pages of specified uuBookKit book."
  },
  {
    header: "Synopsis",
    content: [
      "uubookkit-exporter {bold --book} {underline url} {bold --token} {underline token} {bold --output} {underline dir} [{bold --binaries}] [{bold --draws}]",
      "uubookkit-exporter {bold --help}"
    ]
  },
  {
    header: "Options",
    optionList: optionDefinitions
  }
];
const usage = commandLineUsage(sections);
const options = commandLineArgs(optionDefinitions);

const valid = options.help || (options.book && options.token && options.output);
if (!valid || options.help) {
  console.log(usage);
  process.exit();
}

let exportOptions = {
  exportBinaries: Boolean(options.binaries),
  exportDraws: Boolean(options.draws)
}
exportBook(options.book, options.token, options.output, exportOptions);