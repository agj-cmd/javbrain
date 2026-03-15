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
	Create an outline before or after you type your prose [
		 \\Note: creation of sections done with hotkey, and formatting is as well. So you don't ever have to type brackets or manually indentat. You can just type and then later select text and wrap into the sections that make sense, or begin by auto-inserting sections to build an outline and then fill it in. I usually do a bit of both.\\
		 \\Sections automatically colored by nested level so colors always tell you where you are structurally.\\
		 \\Sections generate table of contents.\\
		 \\Brackets hidden in the editor so they do not pollute your prose.\\
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
		 \\That's pretty much it!\\
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
		 *Italic. Consider it carefully.*
		 **Bold. This matters.**
		 \Subdued note. Useful for inline placeholder notes when drafting.\
		 \\CALLOUT BLOCKS: Leave yourself a note.\\
		 "Dialogue gets it's own colors and quotes are replaced with smart quotes (non-destructively)."
		- List can be colored and styled as well, and do not indent like paragraph text.
		• Bullet list
		1. Numbered list
	]
	Paragraphs [
		• Each line is a paragraph.
		• No empty lines. Paragraphs are indented like in an ebook.
		• List are not indented
	]
	Compared to Markdown [
		• **Designed only for outline-driven prose**.
		• The **outlining** can easily be added **before, during, or after prose writing** without difficulty.
		• All markup is hidden so you only see your text
		• Sections are indented and colored so structure is easy to track at a glance. (This website is rendered in jav style)
		• **What you see is what you get in the text editor**. All rendering is accomplished in the VS Code viewport so you have the benefit of working in a text editor.
		• **More compact**. Line break is paragraph, not double line break. Renders the same as an e-book with indented paragraphs and no extra space between.
		• **More visual**. Nested colored sections instead of flat headers. Easier to organize into scenes and beats without glancing back and forth at a table of contents or scrolling around to reorient.
	]
]