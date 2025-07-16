#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { minify } = require('../lib/minifier');

function showHelp() {
  console.log(`
Stormworks Lua Minifier CLI

Usage: stormworks-lua-minifier <input-file> <output-file> [options]

Arguments:
  input-file     Input Lua file to minify
  output-file    Output file for minified Lua code

Options:
  --no-rename-globals          Disable renaming of global variables (default: enabled)
  --no-shorten-libraries       Disable shortening of library function calls (default: enabled)
  --no-shorten-string-literals Disable string literal reuse (default: enabled)  
  --no-coalesce-locals         Disable local variable coalescing (default: enabled)
  --help, -h                   Show this help message

Examples:
  stormworks-lua-minifier input.lua output.lua
  stormworks-lua-minifier script.lua minified.lua --no-shorten-string-literals
  stormworks-lua-minifier code.lua min.lua --no-rename-globals --no-coalesce-locals
`);
}

function parseArgs(args) {
  const options = {
    renameGlobals: true,
    shortenLibraries: true,
    shortenStringLiterals: true,
    coalesceLocals: true
  };
  
  let inputFile, outputFile;
  
  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    } else if (arg === '--no-rename-globals') {
      options.renameGlobals = false;
    } else if (arg === '--no-shorten-libraries') {
      options.shortenLibraries = false;
    } else if (arg === '--no-shorten-string-literals') {
      options.shortenStringLiterals = false;
    } else if (arg === '--no-coalesce-locals') {
      options.coalesceLocals = false;
    } else if (!inputFile) {
      inputFile = arg;
    } else if (!outputFile) {
      outputFile = arg;
    } else {
      console.error(`Error: Unknown argument '${arg}'`);
      showHelp();
      process.exit(1);
    }
  }
  
  if (!inputFile || !outputFile) {
    console.error('Error: Both input and output files must be specified');
    showHelp();
    process.exit(1);
  }
  
  return { inputFile, outputFile, options };
}

function main() {
  const { inputFile, outputFile, options } = parseArgs(process.argv);
  
  // Check if input file exists
  if (!fs.existsSync(inputFile)) {
    console.error(`Error: Input file '${inputFile}' does not exist`);
    process.exit(1);
  }
  
  try {
    // Read input file
    const code = fs.readFileSync(inputFile, 'utf8');
    const originalSize = code.length;
    
    console.log(`Minifying '${inputFile}'...`);
    console.log(`Original size: ${originalSize} characters`);
    
    // Minify the code
    const minifiedCode = minify(code, options);
    const minifiedSize = minifiedCode.length;
    
    // Write output file
    fs.writeFileSync(outputFile, minifiedCode, 'utf8');
    
    // Show results
    const compressionRatio = ((1 - minifiedSize / originalSize) * 100).toFixed(1);
    console.log(`Minified size: ${minifiedSize} characters`);
    console.log(`Compression: ${compressionRatio}% smaller`);
    console.log(`Output written to '${outputFile}'`);
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}