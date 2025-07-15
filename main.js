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
    "isyieldable"
  ],
  debug: [
    "getinfo",
    "traceback",
    "getlocal",
    "getupvalue"
  ],
  os: [
    "clock",
    "date",
    "difftime",
    "time"
  ],
  component: [
    "doc",
    "fields",
    "invoke",
    "list",
    "methods",
    "proxy",
    "slot",
    "type"
  ],
  computer: [
    "address",
    "addUser",
    "beep",
    "energy",
    "freeMemory",
    "getArchitectures",
    "getArchitecture",
    "getDeviceInfo",
    "getProgramLocations",
    "isRobot",
    "maxEnergy",
    "pullSignal",
    "pushSignal",
    "removeUser",
    "setArchitecture",
    "shutdown",
    "tmpAddress",
    "totalMemory",
    "uptime",
    "users"
  ]
};
const globalFunctions = [
  "ipairs",
  "pairs",
  "next",
  "tonumber",
  "tostring",
  "type",
  "print",
  "assert",
  "error",
  
  // opencomputers
  "getmetatable",
  "load",
  "pcall",
  "rawequal",
  "rawget",
  "rawlen",
  "rawset",
  "select",
  "setmetatable",
  "xpcall"
];
const callbacks = [
  "onTick",
  "onDraw",
  "httpReply"
];

function minify(string, options) {
  console.log("----------------------------");
  console.log(
    "minifying " + Math.round(string.length / 100) / 10 + " kb of code"
  );
  console.log(options);
  
  var t0 = t = performance.now();
  var ast = luaparse.parse(string, { luaVersion: "5.3", scope: true });
  console.log(ast);
  console.log("luaparse:                " + (performance.now() - t).toFixed(1) + " ms");

  // declare non-library globals as locals at root so that minifier can rename all occurences
  // todo figure out a way to do this through the ast (without string manipulation)
  if (options.renameGlobals) {
    t = performance.now();
    var numLocals = 0;
    ast.globals.forEach(global => {
      if (
        !libraryFunctions[global.name] &&
        !globalFunctions.includes(global.name) &&
        !callbacks.includes(global.name) &&
        global.name !== "g_savedata"
      ) {
        //if (ast.body.every(chunk => !chunk.type === "AssignmentStatement" && chunk.variables[0].name === global.name && (libraryFunctions[chunk.init[0].name] || globalFunctions.includes(chunk.init[0].name)))) {
          string = "local " + global.name + ";" + string;
          numLocals++;
        //}
      }
    });
    ast = luaparse.parse(string, { luaVersion: "5.3", scope: true });
    ast.body.splice(0, numLocals);
    console.log("renameGlobals:           " + (performance.now() - t).toFixed(1) + " ms");
  }
  
  // coalesce local declarations
  if (options.coalesceLocals) {
    function searchForIdentifier(any, target) {
      for (const v of Object.values(any)) {
        if (typeof(v) === "object" && v !== null) {
          if (Array.isArray(v)) {
            for (const e of v) {
              if (typeof(e) !== "object") continue;
              if (e.type === "Identifier" && e.name === target) return true;
              else if (searchForIdentifier(e, target)) return true;
            }
          } else if (v.type === "Identifier" && v.name === target) return true;
          else if (searchForIdentifier(v, target)) return true;
        }
      }
      return false;
    }

    t = performance.now();
    let coalesceLocals;
    coalesceLocals = function(body) {
      for (let i = 0; i < body.length; i++) {
        const entry = body[i];
        const nextEntry = body[i + 1];
        if (i < body.length - 1 && entry.type === "LocalStatement" && nextEntry.type === "LocalStatement") {
          let cunt = false;
          for (const v of entry.variables) if (searchForIdentifier(nextEntry, v.name)) { cunt = true; break; }
          if (cunt) continue;
          entry.init = entry.init.concat(nextEntry.init);
          entry.variables = entry.variables.concat(nextEntry.variables);
          //console.log(entry);
          body.splice(i + 1, 1);
          i = -1;
        } else if (entry.body) coalesceLocals(entry.body);
      }
    }
    coalesceLocals(ast.body);
    console.log("coalesceLocals:           " + (performance.now() - t).toFixed(1) + " ms");
  }
  
  // hand over to external minifier
  t = performance.now();
  string = luamin.minify(ast);
  ast = luaparse.parse(string, { luaVersion: "5.3", scope: true });
  console.log("luamin:                  " + (performance.now() - t).toFixed(1) + " ms");
  
  // shorten libraries and relating functions
  if (options.shortenLibraries) {
    t = performance.now();
    
    // globals
    
    const globalMap = new Map();
    let traverse;
    traverse = function(self) {
      if (Object.hasOwn(self, "type") && self.type === "Identifier" && self.isLocal !== true) {
        
        const global = self.name;
        if (!globalFunctions.includes(global)) return;
        if (!globalMap.has(global)) globalMap.set(global, []);
        
        globalMap.get(global).push(self);
        
      } else if (typeof self === "object") {
        for (const prop in self) if (self[prop] !== null) traverse(self[prop]);
      }
    }
    traverse(ast.body);
    
    for (const [global, occurrences] of globalMap) {
      if (occurrences.length > 1) {
        const globalId = luamin.generateIdentifier(global);
        occurrences.forEach(occurrence => occurrence.name = globalId);
        ast.body.unshift({
          type: "AssignmentStatement",
          init: [{
            isLocal: false,
            name: global,
            type: "Identifier"
          }],
          variables: [{
            isLocal: false,
            name: globalId,
            type: "Identifier"
          }]
        });
      }
    }
    
    /*globalFunctions.forEach(func => {
      const regExp = new RegExp("\\b" + func + "\\(", "g");
      if ((string.match(regExp) || []).length > 1) {
        const funcId = luamin.generateIdentifier(func);
        string = `${funcId}=${func};` + string.replaceAll(regExp, funcId + "(");
      }
    });*/
    
    // library
    
    const baseMap = new Map();
    
    traverse = function(self) {
      if (Object.hasOwn(self, "type") && self.type === "MemberExpression") {
        
        const base = self.base.name;
        if (!Object.keys(libraryFunctions).includes(base)) return;
        if (!baseMap.has(base)) baseMap.set(base, new Map());
        
        const identifierMap = baseMap.get(base);
        
        const identifier = self.identifier.name;
        if (!identifierMap.has(identifier)) identifierMap.set(identifier, []);
        
        identifierMap.get(identifier).push(self);
        
      } else if (typeof self === "object") {
        for (const prop in self) if (self[prop] !== null) traverse(self[prop]);
      }
    }
    traverse(ast.body);
    
    for (const [base, identifierMap] of baseMap) {
      const baseId = Array.from(identifierMap.values()).flat().length > 1 ? luamin.generateIdentifier(base) : null;
      
      for (const [identifier, occurrences] of identifierMap) {
        if (occurrences.length > 1) {
          const id = luamin.generateIdentifier(base + "." + identifier);
          occurrences.forEach(occurrence => {
            //occurrence.isLocal = false;
            occurrence.name = id;
            delete occurrence.base;
            delete occurrence.identifier;
            delete occurrence.indexer;
            occurrence.type = "Identifier";
          });
          ast.body.unshift({
            type: "AssignmentStatement",
            init: [{
              base: { type: "Identifier", name: baseId ?? base, isLocal: false },
              identifier: { type: "Identifier", name: identifier },
              indexer: ".",
              type: "MemberExpression"
            }],
            variables: [{
              isLocal: false,
              name: id,
              type: "Identifier"
            }]
          });
        } else if (baseId) occurrences.forEach(occurrence => occurrence.base.name = baseId);
      }
      
      if (baseId) ast.body.unshift({
        type: "AssignmentStatement",
        init: [{
          isLocal: false,
          name: base,
          type: "Identifier"
        }],
        variables: [{
          isLocal: false,
          name: baseId,
          type: "Identifier"
        }]
      });
    }
    
    /*for (const library in libraryFunctions) {
      if (string.includes(library)) {
        const libraryId = ((string.match(new RegExp("\\b" + library + "\\.", "g")) || []).length > 1) ? luamin.generateIdentifier(library) : null; // library is used more than once, so can shorten
        
        libraryFunctions[library].forEach(func => {
          const regExp = new RegExp("\\b" + library + "\\." + func + "\\(", "g");
          const matches = (string.match(regExp) || []).length;
          
          if (matches > 1) {
            const funcId = luamin.generateIdentifier(library + "." + func);
            string = string.replaceAll(regExp, funcId + "(");
            if (libraryId) {
              string = `${funcId}=${libraryId}.${func};` + string;
            } else string = `${funcId}=${library}.${func};` + string;
          } else if (matches <= 1 && libraryId) {
            string = string.replaceAll(regExp, libraryId + "." + func + "(");
          }
        });
        
        if (libraryId) string = `${libraryId}=${library};` + string;
      }
    }*/
    
    console.log("shortenLibraries:        " + (performance.now() - t).toFixed(1) + " ms");
  }
  
  if (options.shortenStringLiterals) {
    t = performance.now();
    
    string = luamin.minify(ast);
    //ast = luaparse.parse(string, { luaVersion: "5.3", scope: true });
    
    var numLocals = 0;
    ast.globals.forEach(global => {
      if (
        !libraryFunctions[global.name] &&
        !globalFunctions.includes(global.name) &&
        !callbacks.includes(global.name) &&
        global.name !== "g_savedata"
      ) {
        //if (ast.body.every(chunk => !chunk.type === "AssignmentStatement" && chunk.variables[0].name === global.name && (libraryFunctions[chunk.init[0].name] || globalFunctions.includes(chunk.init[0].name)))) {
          string = "local " + global.name + ";" + string;
          numLocals++;
        //}
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
  // shorten math.pi (defunct due to updated "reuse libraries and library functions": now supports variables)
  //if ((string.match(new RegExp("\\bmath\\.pi", "g")) || []).length > 1) string = luamin.generateIdentifier("math.pi") + "=" + "math.pi;" + string.replaceAll(new RegExp("\\bmath\\.pi", "g"), luamin.generateIdentifier("math.pi"));
  // shorten math.huge (defunct due to updated "reuse libraries and library functions": now supports variables)
  //if ((string.match(new RegExp("\\bmath\\.huge", "g")) || []).length > 1) string = luamin.generateIdentifier("math.huge") + "=" + "math.huge;" + string.replaceAll(new RegExp("\\bmath\\.huge", "g"), luamin.generateIdentifier("math.huge"));
  // change 0.x to .x
  string = string.replaceAll(new RegExp("\\b0\\.", "g"), ".");
  
  /*if (options.split) {
    const matches = string.match(/[\s\S]{1,500}/g) || [];
    string = matches.join("\n\n");
  }*/
  
  console.log(
    "minified to " +
      Math.round(string.length / 100) / 10 +
      " kb of code. took " +
      (performance.now() - t0).toFixed(1) +
      " ms"
  );
  
  return string;
}

var previousCode = "";
document.getElementById("minifyButton").onclick = function() {
  // setup
  var code = document.getElementById("codeTextArea").value;
  const previousLength = code.length;
  previousCode = code;

  // minify
  try {
    code = minify(code, {
      renameGlobals: document.getElementById("renameGlobals").checked,
      shortenLibraries: document.getElementById("shortenLibraries").checked,
      shortenStringLiterals: document.getElementById("shortenStringLiterals").checked,
      coalesceLocals: document.getElementById("coalesceLocals").checked,
      //split: document.getElementById("split").checked
    });
  } catch (error) {
    document.getElementById(
      "status"
    ).innerHTML = `<span style="color:red"><b>${error.name}:</b> ${error.message}</span>`;
    throw(error);
    return;
  }

  // return
  document.getElementById("codeTextArea").value = code;
  document.getElementById("status").innerHTML = `${
    code.length
  } chars<br><span style="color:green">${(
    (1 - code.length / previousLength) *
    100
  ).toFixed(1)}% smaller</span> (${previousLength} chars)`;
  document.getElementById("viewOriginalButton").disabled = false;
};

document.getElementById("viewOriginalButton").onclick = function() {
  document.getElementById("codeTextArea").value = previousCode;
  document.getElementById("viewOriginalButton").disabled = true;
  document.getElementById("status").innerText =
    document.getElementById("codeTextArea").value.length + " chars";
};

document.getElementById("codeTextArea").oninput = function() {
  document.getElementById("status").innerText =
    document.getElementById("codeTextArea").value.length + " chars";
};
