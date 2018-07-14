#!/usr/bin/env node

let exportBook = require("../export");
const commandLineArgs = require("command-line-args");
const commandLineUsage = require("command-line-usage")


const parametersdefinitions =[
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
    name: "help",
    alias: "h",
    type: Boolean,
    description: "Displays this usage guide."
  }
];

const optionDefinitions = [
  {
    name: "binaries",
    alias: "B",
    type: Boolean,
    description: "Export also referred binaries."
  },
  {
    name: "draws",
    alias: "D",
    type: Boolean,
    description: "Export also referred UuBml.Draws."
  },
  {
    name: "transform",
    alias: "T",
    type: Boolean,
    description: "Transform page body to formatted uu5string and stores it to another file."
  }
];
const cliDefinition = [
  ...parametersdefinitions,
  ...optionDefinitions
];
const sections = [
  {
    header: "uuBookKit-exporter",
    content: "Export source JSON files for all pages of specified uuBookKit book."
  },
  {
    header: "Synopsis",
    content: [
      "uubookkit-exporter [options] {bold --book} {underline url} {bold --token} {underline token} {bold --output} {underline dir}",
      "uubookkit-exporter {bold --help}"
    ]
  },
  {
    header: "Parameters",
    optionList: parametersdefinitions
  },
  {
    header: "Options",
    optionList: optionDefinitions
  }
];
const usage = commandLineUsage(sections);
const options = commandLineArgs(cliDefinition);

const valid = options.help || (options.book && options.token && options.output);
if (!valid || options.help) {
  console.log(usage);
  process.exit();
}

let exportOptions = {
  exportBinaries: Boolean(options.binaries),
  exportDraws: Boolean(options.draws),
  transformBody: Boolean(options.transform)
}
exportBook(options.book, options.token, options.output, exportOptions);