# swluamin

awesome stormworks lua minifier for stormworks the building and rescuing and shooting and industry game on steam the digital game distribution front-end by valve corporation

**NOTE: cli-tool was adapted from the browser version entirely using GitHub Copilot agent mode (see pull request)**

## Web Interface

go to [https://gmhater73.github.io/stormworks-lua-minifier/](https://gmhater73.github.io/stormworks-lua-minifier/) for the web-based minifier

## Command Line Tool

### Installation

Install globally via npm:

```bash
npm install -g swluamin
```

Or use with npx (no installation required):

```bash
npx swluamin input.lua output.lua
```

### Usage

```bash
swluamin <input-file> <output-file> [options]
```

**Arguments:**
- `input-file`: Input Lua file to minify
- `output-file`: Output file for minified Lua code

**Options:**
- `--no-rename-globals`: Disable renaming of global variables (default: enabled)
- `--no-shorten-libraries`: Disable shortening of library function calls (default: enabled)
- `--no-shorten-string-literals`: Disable string literal reuse (default: enabled)
- `--no-coalesce-locals`: Disable local variable coalescing (default: enabled)
- `--help, -h`: Show help message

**Examples:**

```bash
# Basic minification with all optimizations enabled
swluamin script.lua minified.lua

# Disable string literal optimization (useful if you get errors)
swluamin script.lua minified.lua --no-shorten-string-literals

# Disable multiple optimizations
swluamin script.lua minified.lua --no-rename-globals --no-coalesce-locals

# Show help
swluamin --help
```

## Features

uses a modified version of [luamin](https://github.com/mathiasbynens/luamin) that was itself modified by [crazyfluffypony](https://lua.flaffipony.rocks/) as well as [luaparse](https://github.com/fstirlitz/luaparse) then conducts shenanigans to minify it further in a way that hopefully doesn't break your code
