const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Load luaparse and luamin modules
const luaparse = require('../luaparse.js');
require('../luamin.js'); // luamin attaches itself to global context

const libraryFunctions = {
  math: [
    "abs",
    "acos",
    "asin",
    "atan",
    "ceil",
    "cos",
    "deg",
    "exp",
    "floor",
    "fmod",
    "log",
    "max",
    "maxinteger",
    "min",
    "mininteger",
    "modf",
    "rad",
    "random",
    "randomseed",
    "sin",
    "sqrt",
    "tan",
    "tointeger",
    "type",
    "ult",
    "pi", // variable; included
    "huge", // variable; included
  ],
  string: [
    "byte",
    "char",
    "dump",
    "find",
    "format",
    "gmatch",
    "gsub",
    "len",
    "lower",
    "match",
    "pack",
    "packsize",
    "rep",
    "reverse",
    "sub",
    "unpack",
    "upper"
  ],
  table: ["concat", "insert", "move", "pack", "remove", "sort", "unpack"],
  input: ["getNumber", "getBool"],
  output: ["setBool", "setNumber"],
  map: ["mapToScreen", "screenToMap"],
  property: ["getBool", "getNumber", "getText"],
  screen: [
    "drawCircle",
    "drawCircleF",
    "drawClear",
    "drawLine",
    "drawMap",
    "drawRect",
    "drawRectF",
    "drawText",
    "drawTextBox",
    "drawTriangle",
    "drawTriangleF",
    "getHeight",
    "getWidth",
    "setColor",
    "setMapColorGrass",
    "setMapColorLand",
    "setMapColorOcean",
    "setMapColorSand",
    "setMapColorShallows",
    "setMapColorSnow"
  ],
  async: ["httpGet"],
  
  // opencomputers
  bit32: [
    "arshift",
    "band",
    "bnot",
    "bor",
    "btest",
    "bxor",
    "extract",
    "lrotate",
    "lshift",
    "replace",
    "rrotate",
    "rshift"
  ],
  coroutine: [
    "create",
    "resume",
    "running",
    "status",
    "wrap",
    "yield",
  ],
  io: ["close", "flush", "input", "lines", "open", "output", "popen", "read", "tmpfile", "type", "write"],
  os: ["clock", "date", "difftime", "execute", "exit", "getenv", "remove", "rename", "setlocale", "time", "tmpname"],
  debug: ["debug", "getfenv", "gethook", "getinfo", "getlocal", "getmetatable", "getregistry", "getupvalue", "getuservalue", "setfenv", "sethook", "setlocal", "setmetatable", "setupvalue", "setuservalue", "traceback", "upvalueid", "upvaluejoin"],
  computer: ["getInfo", "energy", "maxEnergy", "shutdown", "pushSignal", "pullSignal", "pullSignalOrTimeout", "beep", "getBootAddress", "getTemporaryDirectory", "getUsers", "addUser", "removeUser", "freeMemory", "totalMemory", "uptime", "address"],
  buffer: ["new", "bitblt", "copy", "fill", "get", "set"],
  component: ["isAvailable", "isPrimary", "list", "type", "doc", "methods", "fields", "invoke", "slot", "proxy", "get", "getPrimary"],
  event: ["computer", "listen", "ignore", "timer", "pull", "pullMultiple", "pullFiltered", "push", "register", "unregister"],
  filesystem: ["list", "exists", "isDirectory", "lastModified", "size", "remove", "rename", "makeDirectory", "copy", "open", "close", "read", "seek", "write"],
  keyboard: ["isAltDown", "isControl", "isControlDown", "isShift", "isShiftDown", "keys"],
  process: ["load", "running"],
  require: [], // doesn't exist
  shell: ["getAlias", "setAlias", "getWorkingDirectory", "setWorkingDirectory", "getPath", "setPath", "resolve", "execute", "parse"],
  sides: ["bottom", "top", "back", "front", "right", "left", "down", "up", "north", "south", "west", "east", "negy", "posy", "negz", "posz", "negx", "posx"],
  term: ["isAvailable", "clear", "clearLine", "cursor", "bind", "screen", "keyboard", "gpu", "pull", "read", "write"],
  text: ["detab", "padLeft", "padRight", "trim", "wrap", "tokenize"],
  thread: ["create", "waitForAny", "waitForAll"],
  unicode: ["char", "len", "lower", "reverse", "sub", "upper", "wlen", "wtrunc"],
  uuid: ["next"]
};

const globalFunctions = [
  "assert",
  "collectgarbage",
  "dofile",
  "error",
  "getfenv",
  "getmetatable",
  "ipairs",
  "load",
  "loadfile",
  "loadstring",
  "next",
  "pairs",
  "pcall",
  "print",
  "rawequal",
  "rawget",
  "rawlen",
  "rawset",
  "require",
  "select",
  "setfenv",
  "setmetatable",
  "tonumber",
  "tostring",
  "type",
  "unpack",
  "xpcall",
  "_G",
  "_VERSION"
];

const callbacks = [
  "onTick", "onCreate", "onDestroy", "onCustomCommand", "onChatMessage", "onPlayerJoin", "onPlayerSit", "onCharacterSit", "onCharacterUnsit", "onCharacterPickup", "onEquipmentPickup", "onEquipmentDrop", "onCreaturePickup", "onPlayerRespawn", "onPlayerLeave", "onToggle", "onPhysicsStep", "onPlayerDie", "httpReply", "onFireExtinguished", "onForestFireSpawned", "onForestFireExtinguished", "onTornado", "onMeteor", "onTsunami", "onWhirlpool", "onVolcano"
];

function minify(code, options = {}) {
  const defaultOptions = {
    renameGlobals: true,
    shortenLibraries: true,
    shortenStringLiterals: true,
    coalesceLocals: true
  };
  
  options = { ...defaultOptions, ...options };
  
  const t0 = performance.now();
  
  let ast;
  try {
    ast = luaparse.parse(code, { luaVersion: "5.3", scope: true });
  } catch (error) {
    throw new Error(`Parse error: ${error.message}`);
  }
  
  let string = luamin.minify(ast);
  
  if (options.renameGlobals) {
    const t = performance.now();
    
    ast.globals.forEach(global => {
      if (
        !libraryFunctions[global.name] &&
        !globalFunctions.includes(global.name) &&
        !callbacks.includes(global.name) &&
        global.name !== "g_savedata"
      ) {
        global.name = luamin.generateIdentifier(global.name);
      }
    });
    
    console.log("renameGlobals:           " + (performance.now() - t).toFixed(1) + " ms");
  }
  
  if (options.coalesceLocals) {
    const t = performance.now();
    
    function coalesceScopeVariables(scope) {
      const usedNames = new Set();
      
      if (scope.variables) {
        scope.variables.sort((a, b) => {
          if (a.references.length === b.references.length) {
            return 0;
          }
          return a.references.length > b.references.length ? -1 : 1;
        });
        
        scope.variables.forEach(variable => {
          if (variable.isLocal) {
            if (usedNames.has(variable.name)) {
              variable.name = luamin.generateIdentifier(variable.name);
            } else {
              usedNames.add(variable.name);
            }
          }
        });
      }
      
      if (scope.children) {
        scope.children.forEach(childScope => coalesceScopeVariables(childScope));
      }
    }
    
    coalesceScopeVariables(ast);
    
    console.log("coalesceLocals:          " + (performance.now() - t).toFixed(1) + " ms");
  }
  
  if (options.shortenLibraries) {
    const t = performance.now();
    
    const libraryCalls = new Map();
    
    function libraryIterate(object) {
      const foundCalls = [];
      
      for (const [key, value] of Object.entries(object)) {
        if (value === null) continue;
        if (value.type === "MemberExpression" && libraryFunctions[value.base.name] && libraryFunctions[value.base.name].includes(value.identifier.name)) foundCalls.push(value);
        else if (Array.isArray(value)) {
          for (const token of value) { Array.prototype.push.apply(foundCalls, libraryIterate(token)); }
        } else if (typeof(value) === "object") Array.prototype.push.apply(foundCalls, libraryIterate(value));
      }
      
      return foundCalls;
    }
    
    const callExpressions = libraryIterate(ast);
    for (const token of callExpressions) {
      const callName = token.base.name + "." + token.identifier.name;
      if (libraryCalls.has(callName)) {
        libraryCalls.get(callName).push(token);
      } else libraryCalls.set(callName, [token]);
    }
    
    libraryCalls.forEach((tokens, callName) => {
      if (tokens.length > 1) {
        for (const token of tokens) {
          token.type = "Identifier";
          token.name = luamin.generateIdentifier(callName);
          token.isLocal = true;
          delete token.base;
          delete token.identifier;
        }
        ast.body.unshift({
          init: [{ type: "MemberExpression", base: { name: callName.split(".")[0], type: "Identifier" }, identifier: { name: callName.split(".")[1], type: "Identifier" } }],
          type: "AssignmentStatement",
          variables: [{ isLocal: true, name: tokens[0].name, type: "Identifier" }]
        });
      }
    });
    
    console.log("shortenLibraries:        " + (performance.now() - t).toFixed(1) + " ms");
  }
  
  if (options.shortenStringLiterals) {
    const t = performance.now();
    
    string = luamin.minify(ast);
    
    let numLocals = 0;
    ast.globals.forEach(global => {
      if (
        !libraryFunctions[global.name] &&
        !globalFunctions.includes(global.name) &&
        !callbacks.includes(global.name) &&
        global.name !== "g_savedata"
      ) {
        string = "local " + global.name + ";" + string;
        numLocals++;
      }
    });
    ast = luaparse.parse(string, { luaVersion: "5.3", scope: true });
    ast.body.splice(0, numLocals);
    
    function stringLiteralsIterate(object) {
      const foundLiterals = [];
      
      for (const [key, value] of Object.entries(object)) {
        if (value === null) continue;
        if (value.type === "StringLiteral") foundLiterals.push(value);
        else if (Array.isArray(value)) {
          for (const token of value) { if (token.type === "StringLiteral") foundLiterals.push(token); else { Array.prototype.push.apply(foundLiterals, stringLiteralsIterate(token)); } }
        } else if (typeof(value) === "object") Array.prototype.push.apply(foundLiterals, stringLiteralsIterate(value));
      }
      
      return foundLiterals;
    }
    
    const strings = new Map();
    const stringLiterals = stringLiteralsIterate(ast);
    for (const token of stringLiterals) {
      if (strings.has(token.raw)) {
        strings.get(token.raw).push(token);
      } else strings.set(token.raw, [token]);
    }
    
    strings.forEach((tokens, stringRaw) => {
      if (tokens.length > 1 && stringRaw.length >= 4) {
        for (const token of tokens) {
          token.type = "Identifier";
          token.name = luamin.generateIdentifier(stringRaw);
          token.isLocal = true;
          delete token.raw;
          delete token.value;
        }
        ast.body.unshift({
          init: [{ type: "StringLiteral", value: null, raw: stringRaw }],
          type: "AssignmentStatement",
          variables: [{ isLocal: true, name: tokens[0].name, type: "Identifier" }]
        });
      }
    });
    
    console.log("shortenStringLiterals:   " + (performance.now() - t).toFixed(1) + " ms");
  }
  
  string = luamin.minify(ast);
  
  // miscellaneous
  // change 0.x to .x
  string = string.replaceAll(new RegExp("\\b0\\.", "g"), ".");
  
  console.log(
    "minified to " +
      Math.round(string.length / 100) / 10 +
      " kb of code. took " +
      (performance.now() - t0).toFixed(1) +
      " ms"
  );
  
  return string;
}

module.exports = { minify };