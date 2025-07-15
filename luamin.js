/*! https://mths.be/luamin v1.0.4 by @mathias
    modified by CrazyFluffyPony */
/*           -- Modified by turnip --          */
; (function(root) {

    // Detect free variable `global`, from Node.js or Browserified code,
    // and use it as `root`
    var freeGlobal = typeof global == 'object' && global;
    if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal) root = freeGlobal;

    /*--------------------------------------------------------------------------*/

    var regexAlphaUnderscore = /[a-zA-Z_]/;
    var regexAlphaNumUnderscore = /[a-zA-Z0-9_]/;
    var regexDigits = /[0-9]/;

    // http://www.lua.org/manual/5.2/manual.html#3.4.7
    // http://www.lua.org/source/5.2/lparser.c.html#priority
    var PRECEDENCE = {
        'or': 1,
        'and': 2,
        '<': 3, '>': 3, '<=': 3, '>=': 3, '~=': 3, '==': 3,
        '..': 5,
        '+': 6, '-': 6, // binary -
        '*': 7, '/': 7, '%': 7, '//': 7,
        'unarynot': 8, 'unary#': 8, 'unary-': 8, // unary -
        '^': 10
    };

    var IDENTIFIER_PARTS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a',
        'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p',
        'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'A', 'B', 'C', 'D', 'E',
        'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
        'U', 'V', 'W', 'X', 'Y', 'Z', '_'];
    var IDENTIFIER_PARTS_MAX = IDENTIFIER_PARTS.length - 1;

    var each = function (array, fn) {
        const length = array.length;
        var index = -1;
        var max = length - 1;
        while (++index < length) fn(array[index], index < max);
    };

    var hasOwnProperty = {}.hasOwnProperty;
    var extend = function(destination, source) {
        var key;
        if (source) {
            for (key in source) {
                if (hasOwnProperty.call(source, key)) {
                    destination[key] = source[key];
                }
            }
        }
        return destination;
    };

    // http://www.lua.org/manual/5.2/manual.html#3.1
    function isKeyword(id) {
        switch (id.length) {
            case 2:
                return 'do' == id || 'if' == id || 'in' == id || 'or' == id;
            case 3:
                return 'and' == id || 'end' == id || 'for' == id || 'nil' == id ||
                    'not' == id;
            case 4:
                return 'else' == id || 'goto' == id || 'then' == id || 'true' == id;
            case 5:
                return 'break' == id || 'false' == id || 'local' == id ||
                    'until' == id || 'while' == id;
            case 6:
                return 'elseif' == id || 'repeat' == id || 'return' == id;
            case 8:
                return 'function' == id;
        }
        return false;
    }

    var currentIdentifier;
    var identifierMap;
    var identifiersInUse;
    var generateIdentifier = function(originalName) {
        // Preserve `self` in methods
        if (originalName == 'self') return originalName;

        if (hasOwnProperty.call(identifierMap, originalName)) return identifierMap[originalName];

        var length = currentIdentifier.length;
        var position = length - 1;
        var character;
        var index;
        while (position >= 0) {
            character = currentIdentifier.charAt(position);
            index = IDENTIFIER_PARTS.indexOf(character);
            if (index != IDENTIFIER_PARTS_MAX) {
                currentIdentifier = currentIdentifier.substring(0, position) +
                    IDENTIFIER_PARTS[index + 1] + ("0".repeat(length - (position + 1)));
                if (
                    isKeyword(currentIdentifier) ||
                    identifiersInUse.indexOf(currentIdentifier) > -1
                ) {
                    return generateIdentifier(originalName);
                }

                identifierMap[originalName] = currentIdentifier;

                return currentIdentifier;
            }
            --position;
        }
        currentIdentifier = 'a' + ("0".repeat(length));
        if (identifiersInUse.indexOf(currentIdentifier) > -1) return generateIdentifier(originalName);

        identifierMap[originalName] = currentIdentifier;

        return currentIdentifier;
    };

    // thanks crazyfluffypony https://gitlab.com/stormworks-tools/editor/-/blob/master/scripts/all.js?ref_type=heads
    var temporaryIdentifiers = {}
    var generateTemporaryIdentifier = function(originalName) {
        if (temporaryIdentifiers[originalName]) {
            temporaryIdentifiers[originalName].usedCount++
        } else {
            temporaryIdentifiers[originalName] = {
                identifier: 'TEMPORARY_IDENTIFIER_' + Object.keys(temporaryIdentifiers).length + '_TEMPORARY_IDENTIFIER',
                originalName: originalName,
                usedCount: 0
            }
        }

        return temporaryIdentifiers[originalName].identifier
    }

    var replaceTemporaryIdentifiersInText = function(text) {
        let returnText = '' + text

        let sortedTemporaryIdentifiers = []

        for (let k of Object.keys(temporaryIdentifiers)) {
            sortedTemporaryIdentifiers.push(temporaryIdentifiers[k])
        }

        sortedTemporaryIdentifiers.sort((a, b) => {
            if (a.usedCount < b.usedCount) {
                return 1
            }

            if (a.usedCount > b.usedCount) {
                return -1
            }

            return 0
        })

        for (let ti of sortedTemporaryIdentifiers) {
            returnText = returnText.replaceAll(new RegExp(ti.identifier, 'g'), generateIdentifier(ti.originalName))
        }

        return returnText
    }

    /*--------------------------------------------------------------------------*/

    var joinStatements = function(a, b, separator = " ") {
        var lastCharA = a.slice(-1);
        var firstCharB = b.charAt(0);

        if (lastCharA == '' || firstCharB == '') {
            return a + b;
        }
        if (regexAlphaUnderscore.test(lastCharA)) {
            if (regexAlphaNumUnderscore.test(firstCharB)) {
                // e.g. `while` + `1`
                // e.g. `local a` + `local b`
                return a + separator + b;
            } else {
                // e.g. `not` + `(2>3 or 3<2)`
                // e.g. `x` + `^`
                return a + b;
            }
        }
        if (regexDigits.test(lastCharA)) {
            if (
                firstCharB == '(' ||
                !(firstCharB == '.' ||
                    regexAlphaUnderscore.test(firstCharB))
            ) {
                // e.g. `1` + `+`
                // e.g. `1` + `==`
                return a + b;
            } else {
                // e.g. `1` + `..`
                // e.g. `1` + `and`
                return a + separator + b;
            }
        }
        if (lastCharA == firstCharB && lastCharA == '-') {
            // e.g. `1-` + `-2`
            return a + separator + b;
        }
        var secondLastCharA = a.slice(-2, -1);
        if (lastCharA == '.' && secondLastCharA != '.' && regexAlphaNumUnderscore.test(firstCharB)) {
            // e.g. `1.` + `print`
            return a + separator + b;
        }
        return a + b;
    };

    var formatBase = function(base) {
        var result = '';
        var type = base.type;
        var needsParens = base.inParens && (
            type == 'CallExpression' ||
            type == 'BinaryExpression' ||
            type == 'FunctionDeclaration' ||
            type == 'TableConstructorExpression' ||
            type == 'LogicalExpression' ||
            type == 'StringLiteral'
        );
        if (needsParens) {
            result += '(';
        }
        result += formatExpression(base);
        if (needsParens) {
            result += ')';
        }
        return result;
    };

    var formatExpression = function(expression, options) {

        options = extend({
            'precedence': 0,
            'preserveIdentifiers': false
        }, options);

        var result = '';
        var currentPrecedence;
        var associativity;
        var operator;

        var expressionType = expression.type;

        /*if (expressionType == 'Identifier') {

            let r1 = identifiersInUse.indexOf(expression.name);
            let r2 = !options.preserveIdentifiers

            result = (typeof r1 !== 'number' || r1 <= 0) && r2
                ? generateTemporaryIdentifier(expression.name)
                : expression.name;

        } else*/ if (
            expressionType == 'StringLiteral' ||
            expressionType == 'NumericLiteral' ||
            expressionType == 'BooleanLiteral' ||
            expressionType == 'NilLiteral' ||
            expressionType == 'VarargLiteral'
        ) {

            result = expression.raw;

        } else if (
            expressionType == 'LogicalExpression' ||
            expressionType == 'BinaryExpression'
        ) {

            // If an expression with precedence x
            // contains an expression with precedence < x,
            // the inner expression must be wrapped in parens.
            operator = expression.operator;
            currentPrecedence = PRECEDENCE[operator];
            associativity = 'left';

            result = formatExpression(expression.left, {
                'precedence': currentPrecedence,
                'direction': 'left',
                'parent': operator
            });
            result = joinStatements(result, operator);
            result = joinStatements(result, formatExpression(expression.right, {
                'precedence': currentPrecedence,
                'direction': 'right',
                'parent': operator
            }));

            if (operator == '^' || operator == '..') {
                associativity = "right";
            }

            if (
                currentPrecedence < options.precedence ||
                (
                    currentPrecedence == options.precedence &&
                    associativity != options.direction &&
                    options.parent != '+' &&
                    !(options.parent == '*' && (operator == '/' || operator == '*'))
                )
            ) {
                // The most simple case here is that of
                // protecting the parentheses on the RHS of
                // `1 - (2 - 3)` but deleting them from `(1 - 2) - 3`.
                // This is generally the right thing to do. The
                // semantics of `+` are special however: `1 + (2 - 3)`
                // == `1 + 2 - 3`. `-` and `+` are the only two operators
                // who share their precedence level. `*` also can
                // commute in such a way with `/`, but not with `%`
                // (all three share a precedence). So we test for
                // all of these conditions and avoid emitting
                // parentheses in the cases where we don’t have to.
                result = '(' + result + ')';
            }

        } else if (expressionType == 'UnaryExpression') {

            operator = expression.operator;
            currentPrecedence = PRECEDENCE['unary' + operator];

            result = joinStatements(
                operator,
                formatExpression(expression.argument, {
                    'precedence': currentPrecedence
                })
            );

            if (
                currentPrecedence < options.precedence &&
                // In principle, we should parenthesize the RHS of an
                // expression like `3^-2`, because `^` has higher precedence
                // than unary `-` according to the manual. But that is
                // misleading on the RHS of `^`, since the parser will
                // always try to find a unary operator regardless of
                // precedence.
                !(
                    (options.parent == '^') &&
                    options.direction == 'right'
                )
            ) {
                result = '(' + result + ')';
            }

        } else if (expressionType == 'CallExpression') {

            result = formatBase(expression.base) + '(';

            each(expression.arguments, function(argument, needsComma) {
                result += formatExpression(argument);
                if (needsComma) {
                    result += ',';
                }
            });
            result += ')';

        } else if (expressionType == 'TableCallExpression') {

            result = formatExpression(expression.base) +
                formatExpression(expression.arguments);

        } else if (expressionType == 'StringCallExpression') {

            result = formatExpression(expression.base) +
                formatExpression(expression.argument);

        } else if (expressionType == 'IndexExpression') {

            result = formatBase(expression.base) + '[' +
                formatExpression(expression.index) + ']';

        } else if (expressionType == 'MemberExpression') {
            result = formatBase(expression.base) + expression.indexer +
                formatExpression(expression.identifier, {
                    'preserveIdentifiers': true
                });


        } else if (expressionType == 'FunctionDeclaration') {

            result = 'function(';
            if (expression.parameters.length) {
                each(expression.parameters, function(parameter, needsComma) {
                    // `Identifier`s have a `name`, `VarargLiteral`s have a `value`
                    result += parameter.name
                        ? generateTemporaryIdentifier(parameter.name)
                        : parameter.value;
                    if (needsComma) {
                        result += ',';
                    }
                });
            }
            result += ')';
            result = joinStatements(result, formatStatementList(expression.body));
            result = joinStatements(result, 'end');

        } else if (expressionType == 'TableConstructorExpression') {

            result = '{';

            each(expression.fields, function(field, needsComma) {
                if (field.type == 'TableKey') {
                    result += '[' + formatExpression(field.key) + ']=' +
                        formatExpression(field.value);
                } else if (field.type == 'TableValue') {
                    result += formatExpression(field.value);
                } else { // at this point, `field.type == 'TableKeyString'`
                    result += formatExpression(field.key, {
                        // TODO: keep track of nested scopes (#18)
                        'preserveIdentifiers': true
                    }) + '=' + formatExpression(field.value);
                }
                if (needsComma) {
                    result += ',';
                }
            });

            result += '}';

        } else if (expressionType == 'Identifier') {
            result = expression.isLocal && !options.preserveIdentifiers ? generateTemporaryIdentifier(expression.name) : expression.name;
        } else {

            throw TypeError('Unknown expression type: `' + expressionType + '`');

        }

        return result;
    };

    var formatStatementList = function(body) {
        var result = '';
        each(body, function(statement) {
            result = joinStatements(result, formatStatement(statement), ';');
        });
        return result;
    };

    var formatStatement = function(statement) {
        var result = '';
        var statementType = statement.type;

        switch (statementType) {
            case "AssignmentStatement":
                // left-hand side
                each(statement.variables, function(variable, needsComma) {
                    result += formatExpression(variable);
                    if (needsComma) result += ',';
                });

                // right-hand side
                result += '=';
                each(statement.init, function(init, needsComma) {
                    result += formatExpression(init);
                    if (needsComma) result += ',';
                });

                break;

            case "LocalStatement":

                result = 'local ';

                // left-hand side
                each(statement.variables, function(variable, needsComma) {
                    // Variables in a `LocalStatement` are always local, duh
                    result += generateTemporaryIdentifier(variable.name);
                    if (needsComma) {
                        result += ',';
                    }
                });

                // right-hand side
                if (statement.init.length) {
                    result += '=';
                    each(statement.init, function(init, needsComma) {
                        result += formatExpression(init);
                        if (needsComma) {
                            result += ',';
                        }
                    });
                }

                break;

            case "CallStatement":
                result = formatExpression(statement.expression);
                break;

            case "IfStatement":
                result = joinStatements(
                    'if',
                    formatExpression(statement.clauses[0].condition)
                );
                result = joinStatements(result, 'then');
                result = joinStatements(
                    result,
                    formatStatementList(statement.clauses[0].body)
                );
                each(statement.clauses.slice(1), function(clause) {
                    if (clause.condition) {
                        result = joinStatements(result, 'elseif');
                        result = joinStatements(result, formatExpression(clause.condition));
                        result = joinStatements(result, 'then');
                    } else {
                        result = joinStatements(result, 'else');
                    }
                    result = joinStatements(result, formatStatementList(clause.body));
                });
                result = joinStatements(result, 'end');
                break;

            case "WhileStatement":
                result = joinStatements('while', formatExpression(statement.condition));
                result = joinStatements(result, 'do');
                result = joinStatements(result, formatStatementList(statement.body));
                result = joinStatements(result, 'end');
                break;

            case "DoStatement":
                result = joinStatements('do', formatStatementList(statement.body));
                result = joinStatements(result, 'end');

            case "ReturnStatement":
                result = 'return';

                each(statement.arguments, function(argument, needsComma) {
                    result = joinStatements(result, formatExpression(argument));
                    if (needsComma) {
                        result += ',';
                    }
                });
                break;

            case "BreakStatement":
                result = 'break';
                break;

            case "RepeatStatement":
                result = joinStatements('repeat', formatStatementList(statement.body));
                result = joinStatements(result, 'until');
                result = joinStatements(result, formatExpression(statement.condition))
                break;

            case "FunctionDeclaration":
                result = (statement.isLocal ? 'local ' : '') + 'function ';
                result += formatExpression(statement.identifier);
                result += '(';

                if (statement.parameters.length) {
                    each(statement.parameters, function(parameter, needsComma) {
                        // `Identifier`s have a `name`, `VarargLiteral`s have a `value`
                        result += parameter.name
                            ? generateTemporaryIdentifier(parameter.name)
                            : parameter.value;
                        if (needsComma) {
                            result += ',';
                        }
                    });
                }

                result += ')';
                result = joinStatements(result, formatStatementList(statement.body));
                result = joinStatements(result, 'end');
                break;

            case "ForGenericStatement":
                // see also `ForNumericStatement`

                result = 'for ';

                each(statement.variables, function(variable, needsComma) {
                    // The variables in a `ForGenericStatement` are always local
                    result += generateTemporaryIdentifier(variable.name);
                    if (needsComma) {
                        result += ',';
                    }
                });

                result += ' in';

                each(statement.iterators, function(iterator, needsComma) {
                    result = joinStatements(result, formatExpression(iterator));
                    if (needsComma) {
                        result += ',';
                    }
                });

                result = joinStatements(result, 'do');
                result = joinStatements(result, formatStatementList(statement.body));
                result = joinStatements(result, 'end');
                break;

            case "ForNumericStatement":
                // The variables in a `ForNumericStatement` are always local
                result = 'for ' + generateTemporaryIdentifier(statement.variable.name) + '=';
                result += formatExpression(statement.start) + ',' +
                    formatExpression(statement.end);

                if (statement.step) {
                    result += ',' + formatExpression(statement.step);
                }

                result = joinStatements(result, 'do');
                result = joinStatements(result, formatStatementList(statement.body));
                result = joinStatements(result, 'end');
                break;

            case "LabelStatement":
                // The identifier names in a `LabelStatement` can safely be renamed
                result = '::' + generateTemporaryIdentifier(statement.label.name) + '::';
                break;

            case "GotoStatement":
                // The identifier names in a `GotoStatement` can safely be renamed
                result = 'goto ' + generateTemporaryIdentifier(statement.label.name);
                break;

            default:
                throw TypeError('Unknown statement type: `' + statementType + '`');
        }

        return result;
    };

    var minify = function(ast) {
        // (Re)set temporary identifier values
        identifierMap = {};
        identifiersInUse = [];
        temporaryIdentifiers = {};
        // This is a shortcut to help generate the first identifier (`a`) faster
        currentIdentifier = '9';
      
        // note globals when generating identifiers
        ast.globals.forEach(global => identifiersInUse.push(global.name));

        return replaceTemporaryIdentifiersInText(formatStatementList(ast.body));
    };
  
    var getIdentifierMap = function() { return identifierMap; }

    /*--------------------------------------------------------------------------*/

    var luamin = {
        'version': '1.0.4',
        'minify': minify,
        'generateIdentifier': generateIdentifier,
        'getIdentifierMap': getIdentifierMap
    };

    root.luamin = luamin;

}(this));
