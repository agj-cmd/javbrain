JAV Writing System [
	About [
		• A suite of extensions for vs code/codium to turn the code editor into ideal narrative writing editor
		• This document in progress. Aim is to provide user experience based wiki style document along with the extensions.
		• TODO: Likely want inline, folding, copyable code blocks so that I can put extensions right in here along with info
	]
	Recall and Find [
		GOAL [
			• Author never needs to think where information is stored, or spend more than a few seconds searching for anything they wrote in the past.
			• Computer aids in recalling and finding information.
			• The author only needs to provide vague hints.
		]
		IMPLEMENTATION [
			 \\Computer is the finder and rememberer. No spatial memory or exact phrasing required. Author provides only minimal hint.\\
			• Hotkey driven immediate-response fuzzy search within file and across files.
			• Fuzzy search words in file(s), or glossary terms. Immediately setup glossary search within filtered set of files, all keyboard driven and does not intefere with work at hand. Once found what you want, easily close all the "extra" stuff and get back to work at hand.
			 **EXAMPLE 1**:
				• In some other chapter, did the hero break his sword?
				• Multi-file search "sword brok".
					•  System finds "sword broken", "broke his sword", "shattered cleaver of Ares" in different files. It returns any word or phrase tagged with associated terms.
				• Found by user tags categories.
				• Retrieve characters/places/ideas by associated terms and find where implemented quickly.
			 **EXAMPLE 2:**
			• Cannot remember character name but recall role and location.
			• Hotkey for glossary search.
			• Type "knight lands, old".
			 Glossary search returns:
			• "Sir Aldric, Knight, Northlands, old and ugly".
			• "Sir Faldric, Knight, Northlands, old but handsome".
			• "Sir Baldric, Knight, Southlands, the old bastard".
			• "Sir Caldric, Knight, Eastlands, the old sage".
			• Select desired and enter to insert at cursor.
		]
	]
	Navigation and Selection. [
		 **Javnav extension**
		 Move and select by clause:
				• For editing, most work is rearranging clauses, not words, so the default movement unit should be clause.
		 Immediate and intuitive move/select by:
					• Word, clause, paragraph, region.
					• Immediate select quotes, notes, regions.
	]
	Traverse by structure [
		 **Outline peek extension**
			• Immediate traverse by outline units.
			• Expand/collapse to see how units fit into the larger structure intuitively.
			• Traverse chapter, scenes, beats, fast and fluid without losing focu.
	]
	Visual aid. Colors highlighting and ruler [
		 **Jav scope extension**
			• Highlight unit with colors to easily show stucture
			• Ruler lines for visual clarity and aid reading when moving up and down the file
			• Toggle easily. For editing, these things help, but for reading and prose writing, it may be preferred to turn them off.
	]
	Chapter order, filter by chapter content [
		 **Glossary dashboard extension**
			• View chapters, change order, filter by content (e.g. character, location, theme, any tags you define).
			• Per chapter read time
			• All chapters read time
	]
	Typing [
		 **Project glossary**
		 Glossary autocomplete:
				• Key terms appear as completion items
				• By frequency and recency.
						• Type a characters name, next time you press the first letter, it will be first thing to popup.
							• Thus, almost never type entire names.
				• Usually you should only need to type first two or three characters of any word.
		 Glossary search:
				• Find all
				• Find in file(s)
	]
	Auto punctuation, text cleanup, formatting. [
		 **Editor Helper**
		 Hammer out the words, computer tidies up spacing, punctuation, capitalization.
		 **Never need to press shift** to capitalize words.
	]
	Advanced autocorrect [
			• Like IOS autocorrect, but uses user glossary and keyboard layout so you won't have surprises
			• Confidently mistype words and don't worry about it.
			• Quickly and easily add words to your dictionary or dump more dictionaries into it easily
			• Automatically capitalizes sentences, corrects typos live
	]
	Word helper [
		 **Via shortcut**
			• Dictionary lookup
			• Synonym lookup and replace
			• Sound-alike (e.g. Close spelling)
			• Rhyming
	]
	Editing. [
		Find things fast without remembering exact word/phrase [
			 **Quick fuzzy extension**
			• Find fast from fuzzy memory
			• Typo tolerant
			• Any word order
			• Split editor ➢ Find ➢ Return to spot
		]
		Compare with saved. [
			 Side-by-side or inline comparison for editing phase.
			 **Example:** Draft 1 shows "The battle raged for hours."
			 Draft 2 shows "They fought until dawn broke." View versions side-by-side or see inline highlighting of changes.
		]
	]
]