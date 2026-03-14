var vscode = require( 'vscode' );

// ── Defaults ────────────────────────────────────────────────────────────────

var DEFAULT_SCOPE_LEVELS = [
    {
        colorBackground: "#003300",
        colorBorder: "",
        borderWidth: "1px",
        borderStyle: "solid",
        colorOverview: "#0000aa",
        colorEnd: "#ff000080"
    },
    {
        colorBackground: "#1a0033",
        colorBorder: "",
        borderWidth: "1px",
        borderStyle: "solid",
        colorOverview: "#5500aa",
        colorEnd: "#ff660080"
    },
    {
        colorBackground: "#002244",
        colorBorder: "",
        borderWidth: "1px",
        borderStyle: "solid",
        colorOverview: "#006688",
        colorEnd: "#00ccff80"
    }
];

// ── Util ────────────────────────────────────────────────────────────────────

var openingBrackets = "";
var closingBrackets = "";

function utilUpdateConfig()
{
    if( !vscode.window.activeTextEditor )
    {
        return;
    }

    openingBrackets = "";
    closingBrackets = "";

    if( bracketIsActive( "bracketParentheses" ) )
    {
        openingBrackets += "(";
        closingBrackets += ")";
    }
    if( bracketIsActive( "bracketBraces" ) )
    {
        openingBrackets += "{";
        closingBrackets += "}";
    }
    if( bracketIsActive( "bracketSquare" ) )
    {
        openingBrackets += "[";
        closingBrackets += "]";
    }
}

function bracketIsActive( type )
{
    var language = vscode.window.activeTextEditor.document.languageId;
    var config = vscode.workspace.getConfiguration( 'javscope' );
    var active = config.get( type, true );
    var languages = config.get( 'languages' );
    // Map config key to legacy short name for language override lookup
    var shortName = {
        bracketParentheses: "parentheses",
        bracketBraces: "braces",
        bracketSquare: "squareBrackets"
    }[ type ] || type;
    var override = languages && languages[ language ] && languages[ language ][ shortName ];
    return override !== undefined ? override : active;
}

function bracketIsOpen( char )
{
    return openingBrackets.indexOf( char ) > -1;
}

function bracketIsClose( char )
{
    return closingBrackets.indexOf( char ) > -1;
}

function bracketIsMatch( open, close )
{
    switch( open )
    {
        case '(': return close === ')';
        case '{': return close === '}';
        case '[': return close === ']';
    }
    return false;
}

// ── Search ──────────────────────────────────────────────────────────────────

function searchBackward( text, index )
{
    var bracketStack = [];
    var offset = 0;
    var bracket = '';

    for( var i = index; i >= 0; i-- )
    {
        var char = text.charAt( i );
        if( bracketIsOpen( char ) )
        {
            if( bracketStack.length === 0 )
            {
                bracket = char;
                offset = i;
                return { bracket: bracket, offset: offset };
            }
            else
            {
                var top = bracketStack.pop();
                if( !bracketIsMatch( char, top ) )
                {
                    return { bracket: '', offset: 0 };
                }
            }
        }
        else if( bracketIsClose( char ) )
        {
            bracketStack.push( char );
        }
    }

    return { bracket: bracket, offset: offset };
}

function searchForward( text, index )
{
    var bracketStack = [];
    var offset = text.length;
    var bracket = '';

    for( var i = index; i < text.length; i++ )
    {
        var char = text.charAt( i );
        if( bracketIsClose( char ) )
        {
            if( bracketStack.length === 0 )
            {
                offset = i;
                bracket = char;
                return { bracket: bracket, offset: offset };
            }
            else
            {
                var top = bracketStack.pop();
                if( !bracketIsMatch( top, char ) )
                {
                    return { bracket: '', offset: text.length };
                }
            }
        }
        else if( bracketIsOpen( char ) )
        {
            bracketStack.push( char );
        }
    }

    return { bracket: bracket, offset: offset };
}

// ── Find nested scopes outward from cursor ──────────────────────────────────

function scopesFindAll( text, cursorOffset )
{
    var scopes = [];
    var searchStart = cursorOffset - 1;
    var searchEnd = cursorOffset;

    while( true )
    {
        var back = searchBackward( text, searchStart );
        var fwd = searchForward( text, searchEnd );

        if( !back.bracket || !fwd.bracket || !bracketIsMatch( back.bracket, fwd.bracket ) )
        {
            break;
        }

        scopes.push( {
            openOffset: back.offset,
            closeOffset: fwd.offset
        } );

        // Move outward for next level
        searchStart = back.offset - 1;
        searchEnd = fwd.offset + 1;

        if( searchStart < 0 || searchEnd >= text.length )
        {
            break;
        }
    }

    return scopes;
}

// ── Find scopes for brackets on the cursor's line ───────────────────────────

function scopesFindOnLine( text, cursorOffset, document )
{
    var cursorPos = document.positionAt( cursorOffset );
    var line = document.lineAt( cursorPos.line );
    var lineStartOffset = document.offsetAt( line.range.start );
    var lineEndOffset = document.offsetAt( line.range.end );
    var candidates = [];

    for( var i = lineStartOffset; i <= lineEndOffset; i++ )
    {
        var char = text.charAt( i );
        if( bracketIsOpen( char ) )
        {
            var fwd = searchForward( text, i + 1 );
            if( fwd.bracket && bracketIsMatch( char, fwd.bracket ) )
            {
                candidates.push( { openOffset: i, closeOffset: fwd.offset } );
            }
        }
        else if( bracketIsClose( char ) )
        {
            var back = searchBackward( text, i - 1 );
            if( back.bracket && bracketIsMatch( back.bracket, char ) )
            {
                candidates.push( { openOffset: back.offset, closeOffset: i } );
            }
        }
    }

    if( candidates.length === 0 )
    {
        return [];
    }

    // Pick the innermost (smallest span) scope
    candidates.sort( function( a, b )
    {
        return ( a.closeOffset - a.openOffset ) - ( b.closeOffset - b.openOffset );
    } );

    var best = candidates[ 0 ];

    // Build outward scopes from the chosen bracket pair
    var scopes = [ best ];
    var searchStart = best.openOffset - 1;
    var searchEnd = best.closeOffset + 1;

    while( searchStart >= 0 && searchEnd < text.length )
    {
        var back = searchBackward( text, searchStart );
        var fwd = searchForward( text, searchEnd );

        if( !back.bracket || !fwd.bracket || !bracketIsMatch( back.bracket, fwd.bracket ) )
        {
            break;
        }

        scopes.push( { openOffset: back.offset, closeOffset: fwd.offset } );
        searchStart = back.offset - 1;
        searchEnd = fwd.offset + 1;
    }

    return scopes;
}

// ── Find ALL bracket scopes in entire document ──────────────────────────────

function scopesFindAllInDocument( text )
{
    var stack = []; // { bracket, offset }
    var scopes = []; // { openOffset, closeOffset, depth }

    for( var i = 0; i < text.length; i++ )
    {
        var char = text.charAt( i );
        if( bracketIsOpen( char ) )
        {
            stack.push( { bracket: char, offset: i } );
        }
        else if( bracketIsClose( char ) )
        {
            // Walk stack backward to find matching open
            for( var j = stack.length - 1; j >= 0; j-- )
            {
                if( bracketIsMatch( stack[ j ].bracket, char ) )
                {
                    scopes.push( {
                        openOffset: stack[ j ].offset,
                        closeOffset: i,
                        depth: j // stack index = nesting depth
                    } );
                    stack.splice( j, 1 );
                    break;
                }
            }
        }
    }

    return scopes;
}

// ── Decoration management ───────────────────────────────────────────────────

var decorationTypesRange = [];
var decorationTypesEnd = [];
var decorationTypesRuler = [];

var LANE_ORDER = [
    vscode.OverviewRulerLane.Full,
    vscode.OverviewRulerLane.Left,
    vscode.OverviewRulerLane.Center,
    vscode.OverviewRulerLane.Right
];

function decorationBuildStyle( levelConfig )
{
    var bgAndBorder = {};

    if( levelConfig.colorBackground )
    {
        bgAndBorder.backgroundColor = levelConfig.colorBackground;
    }
    if( levelConfig.colorBorder )
    {
        bgAndBorder.border = ( levelConfig.borderWidth || "1px" ) + " " +
            ( levelConfig.borderStyle || "solid" ) + " " +
            levelConfig.colorBorder;
    }

    var options = {
        light: bgAndBorder,
        dark: bgAndBorder
    };

    var config = vscode.workspace.getConfiguration( 'javscope' );
    if( config.get( 'highlightExtend', false ) )
    {
        options.isWholeLine = true;
    }

    return vscode.window.createTextEditorDecorationType( options );
}

function decorationBuildEndStyle( levelConfig )
{
    var style = {};
    if( levelConfig.colorEnd )
    {
        style.backgroundColor = levelConfig.colorEnd;
    }
    return vscode.window.createTextEditorDecorationType( {
        light: style,
        dark: style
    } );
}

function decorationBuildRulerStyle( levelConfig, lane )
{
    var options = {};
    if( levelConfig.colorOverview )
    {
        options.overviewRulerColor = levelConfig.colorOverview;
        options.overviewRulerLane = lane;
    }
    return vscode.window.createTextEditorDecorationType( options );
}

function decorationDisposeEditor()
{
    decorationTypesRange.forEach( function( d ) { d.dispose(); } );
    decorationTypesEnd.forEach( function( d ) { d.dispose(); } );
    decorationTypesRange = [];
    decorationTypesEnd = [];
}

function decorationDisposeRuler()
{
    decorationTypesRuler.forEach( function( d ) { d.dispose(); } );
    decorationTypesRuler = [];
}

function decorationDisposeAll()
{
    decorationDisposeEditor();
    decorationDisposeRuler();
}

function decorationClearEditor( editor )
{
    if( !editor ) return;
    decorationTypesRange.forEach( function( d ) { editor.setDecorations( d, [] ); } );
    decorationTypesEnd.forEach( function( d ) { editor.setDecorations( d, [] ); } );
}

function decorationClearAll( editor )
{
    if( !editor ) return;
    decorationClearEditor( editor );
    decorationTypesRuler.forEach( function( d ) { editor.setDecorations( d, [] ); } );
}

function decorationRebuild()
{
    decorationDisposeEditor();

    var config = vscode.workspace.getConfiguration( 'javscope' );
    var levels = config.get( 'scopeLevels', DEFAULT_SCOPE_LEVELS );

    levels.forEach( function( levelConfig )
    {
        decorationTypesRange.push( decorationBuildStyle( levelConfig ) );
        decorationTypesEnd.push( decorationBuildEndStyle( levelConfig ) );
    } );
}

// ── Core update ─────────────────────────────────────────────────────────────

function rulerUpdate()
{
    var editor = vscode.window.activeTextEditor;
    if( !editor )
    {
        return;
    }

    decorationDisposeRuler();

    var config = vscode.workspace.getConfiguration( 'javscope' );
    var levels = config.get( 'scopeLevels', DEFAULT_SCOPE_LEVELS );

    var text = editor.document.getText();
    var allScopes = scopesFindAllInDocument( text );
    var rulerByDepth = {};

    for( var s = 0; s < allScopes.length; s++ )
    {
        var scope_r = allScopes[ s ];
        var d = scope_r.depth;
        if( !rulerByDepth[ d ] )
        {
            rulerByDepth[ d ] = [];
        }
        var endOffset = scope_r.closeOffset;
        var closeLine = editor.document.positionAt( endOffset ).line;
        if( closeLine > editor.document.positionAt( scope_r.openOffset + 1 ).line )
        {
            var endPos = editor.document.lineAt( closeLine - 1 ).range.end;
            endOffset = editor.document.offsetAt( endPos );
        }
        rulerByDepth[ d ].push( new vscode.Range(
            editor.document.positionAt( scope_r.openOffset + 1 ),
            editor.document.positionAt( endOffset )
        ) );
    }

    var depths = Object.keys( rulerByDepth );
    for( var di = 0; di < depths.length; di++ )
    {
        var dep = parseInt( depths[ di ], 10 );
        var lane = LANE_ORDER[ dep % LANE_ORDER.length ];
        var rulerLevelConfig = levels[ dep % levels.length ];
        var rulerType = decorationBuildRulerStyle( rulerLevelConfig, lane );
        decorationTypesRuler.push( rulerType );
        editor.setDecorations( rulerType, rulerByDepth[ dep ] );
    }
}

function scopeUpdate()
{
    var editor = vscode.window.activeTextEditor;
    if( !editor )
    {
        return;
    }

    // Clear and rebuild editor decorations only
    decorationClearEditor( editor );
    decorationDisposeEditor();
    decorationRebuild();

    var config = vscode.workspace.getConfiguration( 'javscope' );
    var levels = config.get( 'scopeLevels', DEFAULT_SCOPE_LEVELS );
    var scopeIndentedOnly = config.get( 'scopeIndentedOnly', false );

    var text = editor.document.getText();
    var cursorOffset = editor.document.offsetAt( editor.selection.active );

    var scopes = scopesFindOnLine( text, cursorOffset, editor.document );

    if( scopes.length === 0 )
    {
        scopes = scopesFindAll( text, cursorOffset );
    }

    if( scopes.length === 0 )
    {
        return;
    }

    var scope = scopes[ 0 ];
    var depth = scopes.length - 1;
    var levelIndex = depth % levels.length;

    var start = scope.openOffset + 1;
    var end = scope.closeOffset;

    if( scopeIndentedOnly )
    {
        var startChar = editor.document.positionAt( start ).character - 1;
        if( startChar === 0 )
        {
            return;
        }
    }

    var rangeDecorations = [];
    var endDecorations = [];

    rangeDecorations.push( new vscode.Range(
        editor.document.positionAt( start ),
        editor.document.positionAt( end )
    ) );

    endDecorations.push( new vscode.Range(
        editor.document.positionAt( start - 1 ),
        editor.document.positionAt( start )
    ) );
    endDecorations.push( new vscode.Range(
        editor.document.positionAt( end ),
        editor.document.positionAt( end + 1 )
    ) );

    editor.setDecorations( decorationTypesRange[ levelIndex ], rangeDecorations );
    editor.setDecorations( decorationTypesEnd[ levelIndex ], endDecorations );
}

function configUpdate()
{
    var editor = vscode.window.activeTextEditor;
    decorationClearAll( editor );
    decorationDisposeAll();
    utilUpdateConfig();
    decorationRebuild();
}

// ── Activation ──────────────────────────────────────────────────────────────

function activate( context )
{
    var subscriptions = [];

    vscode.window.onDidChangeTextEditorSelection( function( e )
    {
        if( e && e.textEditor === vscode.window.activeTextEditor )
        {
            scopeUpdate();
        }
    }, null, subscriptions );

    vscode.workspace.onDidChangeTextDocument( function( e )
    {
        var editor = vscode.window.activeTextEditor;
        if( editor && e.document === editor.document )
        {
            rulerUpdate();
        }
    }, null, subscriptions );

    vscode.window.onDidChangeActiveTextEditor( function()
    {
        configUpdate();
        rulerUpdate();
        scopeUpdate();
    }, null, subscriptions );

    vscode.workspace.onDidChangeConfiguration( function( e )
    {
        if( e.affectsConfiguration( 'javscope' ) )
        {
            configUpdate();
            rulerUpdate();
            scopeUpdate();
        }
    }, null, subscriptions );

    configUpdate();
    rulerUpdate();
    scopeUpdate();

    context.subscriptions.push( {
        dispose: function()
        {
            decorationDisposeAll();
            subscriptions.forEach( function( s ) { s.dispose(); } );
        }
    } );
}

exports.activate = activate;