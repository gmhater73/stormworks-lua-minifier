# stormworks-lua-minifier

awesome stormworks lua minifier for stormworks the building and rescuing and shooting and industry game on steam the digital game distribution front-end by valve corporation

imported from glitch.com after they [ran out of money for free hosting](https://blog.glitch.com/post/changes-are-coming-to-glitch/)

**NOTE: cli-tool was created entirely using GitHub Copilot agent mode (see pull request)**

## Web Interface

go to [https://gmhater73.github.io/stormworks-lua-minifier/](https://gmhater73.github.io/stormworks-lua-minifier/) for the web-based minifier

## Command Line Tool

### Installation

Install globally via npm:

```bash
npm install -g stormworks-lua-minifier
```

Or use with npx (no installation required):

```bash
npx stormworks-lua-minifier input.lua output.lua
```

### Usage

```bash
stormworks-lua-minifier <input-file> <output-file> [options]
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
stormworks-lua-minifier script.lua minified.lua

# Disable string literal optimization (useful if you get errors)
stormworks-lua-minifier script.lua minified.lua --no-shorten-string-literals

# Disable multiple optimizations
stormworks-lua-minifier script.lua minified.lua --no-rename-globals --no-coalesce-locals

# Show help
stormworks-lua-minifier --help
```

## Features

uses a modified version of [luamin](https://github.com/mathiasbynens/luamin) that was itself modified by [crazyfluffypony](https://lua.flaffipony.rocks/) as well as [luaparse](https://github.com/fstirlitz/luaparse) then conducts shenanigans to minify it further in a way that hopefully doesn't break your code
