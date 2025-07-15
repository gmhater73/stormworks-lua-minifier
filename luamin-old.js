/*  https://mths.be/luamin v1.0.4 by @mathias  */
/*           -- Modified by turnip --          */
; (function (root) {

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
        '*': 7, '/': 7, '%': 7,
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
    var extend = function (destination, source) {
        if (source) {
            var key;
            for (key in source) {
                if (hasOwnProperty.call(source, key)) destination[key] = source[key];
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
    var generateIdentifier = function (originalName) {
        if (originalName == "self") return originalName;

        if (hasOwnProperty.call(identifierMap, originalName)) return identifierMap[originalName];

        const length = currentIdentifier.length;
        var position = length - 1;
        var character;
        var index;
        while (position >= 0) {
            character = currentIdentifier.charAt(position);
            index = IDENTIFIER_PARTS.indexOf(character);
            if (index != IDENTIFIER_PARTS_MAX) {
                currentIdentifier = currentIdentifier.substring(0, position) +
                    IDENTIFIER_PARTS[index + 1] + ("0".repeat(length - (position + 1)));
                if (isKeyword(currentIdentifier) || identifiersInUse.indexOf(currentIdentifier) > -1) return generateIdentifier(originalName);
                identifierMap[originalName] = currentIdentifier;
                return currentIdentifier;
            }
            --position;
        }
        currentIdentifier = "a" + ("0".repeat(length));
        if (identifiersInUse.indexOf(currentIdentifier) > -1) return generateIdentifier(originalName);
        identifierMap[originalName] = currentIdentifier;
        return currentIdentifier;
    };

    /*--------------------------------------------------------------------------*/

    var joinStatements = function (a, b, separator = " ") {
        var lastCharA = a.slice(-1);
        var firstCharB = b.charAt(0);

        if (lastCharA == '' || firstCharB == '') return a + b;
        if (regexAlphaUnderscore.test(lastCharA)) {
            if (regexAlphaNumUnderscore.test(firstCharB)) return a + separator + b; else return a + b;
        }
        if (regexDigits.test(lastCharA)) {
            if (
                firstCharB == '(' ||
                !(firstCharB == '.' ||
                    regexAlphaUnderscore.test(firstCharB))
            ) return a + b; else return a + separator + b;
        }
        if (lastCharA == firstCharB && lastCharA == '-') return a + separator + b;
        var secondLastCharA = a.slice(-2, -1);
        if (lastCharA == '.' && secondLastCharA != '.' && regexAlphaNumUnderscore.test(firstCharB)) return a + separator + b;
        return a + b;
    };

    var formatBase = function (base) {
        const type = base.type;
        var result = '';
        var needsParens = base.inParens && (
            type == 'CallExpression' ||
            type == 'BinaryExpression' ||
            type == 'FunctionDeclaration' ||
            type == 'TableConstructorExpression' ||
            type == 'LogicalExpression' ||
            type == 'StringLiteral'
        );
        if (needsParens) result += '(';
        result += formatExpression(base);
        if (needsParens) result += ')';
        return result;
    };

    var formatExpression = function (expression, options) {
        options = extend({
            'precedence': 0,
            'preserveIdentifiers': false
        }, options);

        var result = '';
        var currentPrecedence;
        var associativity;
        var operator;

        const expressionType = expression.type;

        if (
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

            if (operator == '^' || operator == '..') associativity = "right";

            if (
                currentPrecedence < options.precedence ||
                (
                    currentPrecedence == options.precedence &&
                    associativity != options.direction &&
                    options.parent != '+' &&
                    !(options.parent == '*' && (operator == '/' || operator == '*'))
                )
            ) result = '(' + result + ')';
        } else {
            switch (expressionType) {
                case "Identifier":
                    result = expression.isLocal && !options.preserveIdentifiers ? generateIdentifier(expression.name) : expression.name;
                    break;

                case "UnaryExpression":
                    operator = expression.operator;
                    currentPrecedence = PRECEDENCE['unary' + operator];

                    result = joinStatements(operator, formatExpression(expression.argument, { 'precedence': currentPrecedence }));

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
                    ) result = '(' + result + ')';
                    break;

                case "CallExpression":
                    result = formatBase(expression.base) + '(';
                    each(expression.arguments, function (argument, needsComma) {
                        result += formatExpression(argument);
                        if (needsComma) {
                            result += ',';
                        }
                    });
                    result += ')';
                    break;

                case "TableCallExpression":
                    result = formatExpression(expression.base) + formatExpression(expression.arguments);
                    break;

                case "StringCallExpression":
                    result = formatExpression(expression.base) + formatExpression(expression.argument);
                    break;

                case "IndexExpression":
                    result = formatBase(expression.base) + '[' + formatExpression(expression.index) + ']';
                    break;

                case "MemberExpression":
                    result = formatBase(expression.base) + expression.indexer + formatExpression(expression.identifier, { 'preserveIdentifiers': true });
                    break;

                case "FunctionDeclaration":
                    result = 'function(';
                    if (expression.parameters.length) {
                        each(expression.parameters, function (parameter, needsComma) {
                            // `Identifier`s have a `name`, `VarargLiteral`s have a `value`
                            result += parameter.name
                                ? generateIdentifier(parameter.name)
                                : parameter.value;
                            if (needsComma) result += ',';
                        });
                    }
                    result += ')';
                    result = joinStatements(result, formatStatementList(expression.body));
                    result = joinStatements(result, 'end');
                    break;

                case "TableConstructorExpression":
                    result = '{';
                    each(expression.fields, function (field, needsComma) {
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
                        if (needsComma) result += ',';
                    });
                    result += '}';
                    break;

                default:
                    throw TypeError('Unknown expression type: `' + expressionType + '`');
            }
        }
        return result;
    };

    var formatStatementList = function (body) {
        var result = '';
        each(body, function (statement) {
            result = joinStatements(result, formatStatement(statement), ';');
        });
        return result;
    };

    var formatStatement = function (statement) {
        var result = '';
        const statementType = statement.type;

        switch (statementType) {
            case "AssignmentStatement":
                each(statement.variables, function (variable, needsComma) {
                    result += formatExpression(variable);
                    if (needsComma) result += ',';
                });
                result += '=';
                each(statement.init, function (init, needsComma) {
                    result += formatExpression(init);
                    if (needsComma) result += ',';
                });
                break;

            case "LocalStatement":
                result = 'local ';
                // left-hand side
                each(statement.variables, function (variable, needsComma) {
                    result += generateIdentifier(variable.name);
                    if (needsComma) result += ',';
                });
                // right-hand side
                if (statement.init.length) {
                    result += '=';
                    each(statement.init, function (init, needsComma) {
                        result += formatExpression(init);
                        if (needsComma) result += ',';
                    });
                }
                break;

            case "CallStatement":
                result = formatExpression(statement.expression);
                break;

            case "IfStatement":
                result = joinStatements(joinStatements(joinStatements('if', formatExpression(statement.clauses[0].condition)), 'then'), formatStatementList(statement.clauses[0].body));
                each(statement.clauses.slice(1), function (clause) {
                    if (clause.condition) {
                        result = joinStatements(joinStatements(joinStatements(result, 'elseif'), formatExpression(clause.condition)), 'then');
                    } else result = joinStatements(result, 'else');
                    result = joinStatements(result, formatStatementList(clause.body));
                });
                result = joinStatements(result, 'end');
                break;

            case "WhileStatement":
                result = joinStatements(joinStatements(joinStatements(joinStatements('while', formatExpression(statement.condition)), 'do'), formatStatementList(statement.body)), 'end');
                break;

            case "DoStatement":
                result = joinStatements(joinStatements('do', formatStatementList(statement.body)), 'end');
                break;

            case "ReturnStatement":
                result = 'return';
                each(statement.arguments, function (argument, needsComma) {
                    result = joinStatements(result, formatExpression(argument));
                    if (needsComma) result += ',';
                });
                break;

            case "BreakStatement":
                result = 'break';
                break;

            case "RepeatStatement":
                result = joinStatements(joinStatements(joinStatements('repeat', formatStatementList(statement.body)), 'until'), formatExpression(statement.condition));
                break;

            case "FunctionDeclaration":
                result = (statement.isLocal ? 'local ' : '') + 'function ';
                result += formatExpression(statement.identifier);
                result += '(';
                if (statement.parameters.length) {
                    each(statement.parameters, function (parameter, needsComma) {
                        // `Identifier`s have a `name`, `VarargLiteral`s have a `value`
                        result += parameter.name
                            ? generateIdentifier(parameter.name)
                            : parameter.value;
                        if (needsComma) result += ',';
                    });
                }
                result += ')';
                result = joinStatements(joinStatements(result, formatStatementList(statement.body)), 'end');
                break;

            case "ForGenericStatement":
                // see also `ForNumericStatement`
                result = 'for ';
                each(statement.variables, function (variable, needsComma) {
                    // The variables in a `ForGenericStatement` are always local
                    result += generateIdentifier(variable.name);
                    if (needsComma) result += ',';
                });
                result += ' in';
                each(statement.iterators, function (iterator, needsComma) {
                    result = joinStatements(result, formatExpression(iterator));
                    if (needsComma) result += ',';
                });
                result = joinStatements(joinStatements(joinStatements(result, 'do'), formatStatementList(statement.body)), 'end');
                break;

            case "ForNumericStatement":
                // The variables in a `ForNumericStatement` are always local
                result = 'for ' + generateIdentifier(statement.variable.name) + '=';
                result += formatExpression(statement.start) + ',' +
                    formatExpression(statement.end);
                if (statement.step) result += ',' + formatExpression(statement.step);
                result = joinStatements(joinStatements(joinStatements(result, 'do'), formatStatementList(statement.body)), 'end');
                break;

            case "LabelStatement":
                // The identifier names in a `LabelStatement` can safely be renamed
                result = '::' + generateIdentifier(statement.label.name) + '::';
                break;

            case "GotoStatement":
                // The identifier names in a `GotoStatement` can safely be renamed
                result = 'goto ' + generateIdentifier(statement.label.name);
                break;

            default:
                throw TypeError('Unknown statement type: `' + statementType + '`');
        }
        return result;
    };

    var minify = function (ast) {
        identifierMap = {};
        identifiersInUse = [];
        currentIdentifier = "9";
        return formatStatementList(ast.body);
    };

    /*--------------------------------------------------------------------------*/

    var luamin = {
        'minify': minify,
        'generateIdentifier': generateIdentifier
    };

    root.luamin = luamin;

}(this));