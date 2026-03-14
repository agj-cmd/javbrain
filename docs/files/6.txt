What is jav syntax? [
	SIMPLE • VISUAL • FLEXIBLE • FAST [
		• A simple bracket-based language for writing and outlining in VS Code/Codium.
		• To be used in conjunction with a suite of extensions to turn the worlds best code editor into the best prose editor
		• All free and open source
		• Similar to markdown, but even simpler and adds visual aid to make outlining fast and simple.
		• Easily organize and review your work in a way that feels natural, like colored sticky notes on a whiteboard.
		• Sections nest visually and create collapsible colored blocks.
		• All markup text is hidden so your text looks close to how it would look in a book as you write it.
		• One text file holds your entire outline, notes, and manuscript.
		• But at the same time, keeping the speed and editing power of working in a text editor, not a clunky graphical interface that looks pretty but is a nightmare to actually write a novel in.
	]
]
Who is jav for? [
	I want...
		• The **easiest way to outline and write without friction between my brain and the computer**.
		• Everything to just be simple text **on my own computer**.
		• To use **free, open source tools**.
		• To use the **top of the line tools**.
		• My outlining, prose, and notes all contained in a **simple text file**.
		• To **manage structure easily** without a billion buttons and menus. No toolbars, no formatting dialogs. Just text.
		• To **write prose as fast as I can** think without having to stop to remember where anything is or perform tedious edits. Every commercial app catered to writers is 20 years behind what text editors like VS Code can do. You may as well chisel your novel in stone if you use Microsoft Word, Google Docs, Scrivener, etc.
		• To adjust my **outline easily and immediately at any time**. Jav sections nest freely, so you can go from a top-level act down to a single beat without switching tools or views or taking your hand off the keyboard.
]
How to write .jav files [
	Create a named section [
		Write a title followed by a bracket. Everything inside is the section content. Close with a bracket.
		Title \[\
		content
		\]\
		Sections nest freely. Content can live at any level: chapter, scene, beat, whatever you need.
		Chapter \[\
		Scene \[\
		Beat \[\
		text
		\]\
		\]\
		\]\
	]
	Example [
		\\Your structure is your outline. Nest as deep as you need.\\
		Chapter 1 [
			\\Chapter notes.\\
			Scene: The morning after Bubba had his ordeal [
				\\Scene notes.\\
				Intro the hungry woman [
					She walked into the room. She was a big, tall, ugly woman. \First time we meet her, add more description.\
					"I ate the entire pie," she said.
					Bubba recoiled. "The entire pie? Have you lost your damn mind?"
				]
			]
		]
	]
	Inline formatting [
		Wrap text in single asterisks for italic:
		\\asterisk text asterisk\\
		*She knew it was over.*
		Wrap text in double asterisks for bold:
		\\asterisk asterisk text asterisk asterisk\\
		**This matters.**
		Wrap text in single backslashes for inline notes:
		\\backslash text backslash\\
		\Check timeline here.\
		Wrap text in double backslashes for callout blocks:
		\\backslash backslash text backslash backslash\\
		\\UNRESOLVED: motivations unclear at this point.\\
		Straight quotes render as curly automatically.
		"He said goodbye" becomes curly on render.
	]
	Paragraphs and lists [
		Each line is a paragraph. No empty lines needed between them like in markdown, so files are much more compact.
		Paragraphs are indented like in a printed book.
		Lines starting with a list marker skip the indent:
		\\• or number followed by dot\\
		• Bullet list
		1. Numbered list
	]
	Compared to markdown [
		• **Designed only for outline-driven prose**.
		• The **outlining** can easily be added **before, during, or after prose writing** without difficulty. Simple shortcuts to turn a selection into a section.
		• **What you see is what you get in the text editor**. All rendering is accomplished in the VS Code viewport so you have the benefit of working in a text editor.
		• **More compact**. Line break is paragraph, not double line break. Renders the same as an e-book with indented paragraphs and no extra space between.
		• **More visual**. Nested colored sections instead of flat headers. Easier to organize into scenes and beats without glancing back and forth at a table of contents or scrolling around to reorient.
		• **Auto-formatting, auto-grammar/capitalization, auto-complete**. Type as fast as you can, typos and punctuation don't matter, it is all automatically cleaned up via hotkeys. Accomplished without AI, just scripting.
	]
]