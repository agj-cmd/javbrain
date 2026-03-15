What is jav syntax? [
	SIMPLE • VISUAL • FLEXIBLE • FAST [
		• A **simple plain text language** for **structured novel writing** in VS Code/Codium.
		• Is used to create and style the content for this website.
		• **Free** and **open source**. Local. Transferrable. Universal.
			• Universal? Jav files can simply be renamed to .txt and will work anywhere. They can also be converted to markdown formatting easily, and vice versa.
		• To be used in conjunction with a suite of extensions which turn the world's best code editor into the **world's best novel editor**.
		• **Simpler than markdown** as it is strictly for novel writing. Adds **visual aids** which highlight arbitrary sections with colors blocks.
		• Like **colored sticky notes** on a whiteboard. **Easily organize** and review your work in a way that **feels natural**.
		• All markup text is hidden so your text looks close to how it would look in a book while you write it.
		• One text file holds your outline, notes, and manuscript. **Pure, elegant, simple**. Abandon the fight against complex, closed systems, e.g. Scrivener, Word.
	]
	Compared to Markdown [
		• **Purpose-built strictly for narrative prose**.
		• **Outline sections** can easily be added **before, during, or after prose writing** without difficulty. If you arrange sections you do not need to adjust other headers since relationship is via nesting, not numbering.
		• Sections are indented and colored so **structure is easy to track** at a glance. \\This website is rendered in jav style\\
		• **No render view and clean text**. All rendering is accomplished in the VS Code viewport simply by collapsing markup characters when the cursor is not near. Achieve visual clarity without splitting the view for a side-by-side render.
		• **More compact**. Single line break is a paragraph, not double line break. Renders the same as an e-book with indented paragraphs and no extra space between. Seeing more of your text on the screen helps avoid getting lost during that structuring phase when you are deciding what to put in your chapters.
		• **More structural visual clarity**. Nested colored sections instead of flat ## headers. Easier to organize into scenes and beats and know where you are.
	]
]
How to write .jav files [
	**Create an outline before, during, or after you type your prose**
	• Create outline sections with hotkey. You are never required to type brackets or manually format.
	• You type regular text, then later select text wrap into sections that make sense, or you may begin by auto-inserting outline sections first and fill it in after.
	• Sections are colored by nested level, so colors inform where you are structurally.
	\\Press L to toggle section colors on and off for a demonstration\\
	• Sections generate table of contents.
	• Brackets and asteriks are hidden in the editor so they do not pollute your prose. You only see the section titles and prose.
	**How to**
	1. Hotkey creates a bracketed section.
	2. Add a title.
	3. Type prose inside the brackets.
	My brilliant title \[\
	My words. I've got the best words.
	\]\
	• Sections nest infinitely. Book, chapter, scene, beat, minibeat... Whatever makes sense to you, there are no rules.
	Chapter \[\
	Scene \[\
	Beat \[\
	Do nostrud sit esse enim ex excepteur. "Sunt minim amet laborum exercitation fugiat dolor culpa aim."
	\]\
	\]\
	\]\
	• If you add a section within a section, or wrap a section around a section, just press the format key and all of the indentation and cleanup happens automatically.
	• That's it!
	Example [
		\\I might leave scene notes up here.\\
		Scene. The morning after bubba had his ordeal. He's hung-over and grouchy. [
			\\Reminder: Bubba heard about this mysterious woman in the last chapter but he was drunk.\\
			Beat. Bubba meets the mysterious woman. [
				She walked into the room. She was wider than Bubba, and taller than him, and twice as ugly. \inline note. First time we mention how she looks. Should we do this earlier?\
				"I ate Loyd's pie," she said. "And don't say nothing bout it to no one or you'll be sorry."
				Bubba recoiled, then shouted, "You ate his special pie? Heavens woman, you play a dangerous game."
			]
			Beat. Bubba falls in love. [
				Suddenly she sprang upon him and squeezed his head in a vice-like hold.
				Bubba cried out, "Damn woman! You're a crazy one, ain't ya?"
				She responded by poking him in the eye, and in that moment, Bubba knew he had met his soul mate.
				\\Review with test readers, they might not buy it.\\
			]
		]
		Scene. Jump ahead to the wedding. [
			Misdirection, make it seem that Bubba ended up with Rosaline. [
				\\todo\\
			]
			Have jimbo reveal the truth after he flies in on his heli-boat [
				\\Or consider doing it with Sarah because of some reason.\\
			]
		]
	]
	Inline formatting [
		*Italic*
		**Bold**
		\General note. Useful for inline placeholder notes when drafting.\
		\\CALLOUT BLOCKS: Leave yourself a big, bright note.\\
		"Dialogue gets it's own colors and quotes are replaced with smart quotes (non-destructively)."
		- List can be colored and styled as well, and do not indent like paragraph text.
		• Bullet list
		1. Numbered list
	]
	Paragraphs [
		• Each line is a paragraph.
		• No empty lines. Paragraphs are indented like in an ebook. This indentation is non-destructive and you can toggle it on an off.
		• List are indented differently, just to make them stand apart from regular text.
	]
]