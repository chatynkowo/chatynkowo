import { marked } from 'marked'

/* Stories and rewards are authored in the admin's Toast UI WYSIWYG, which
   shows a single newline as a visible line break. CommonMark would collapse
   it into a space, so every renderer imports marked from here to keep the
   site's output matching what the author saw in the editor. */
marked.use({ breaks: true })

export { marked }
