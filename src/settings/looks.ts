export type LookId =
  | 'chalk'
  | 'notebook'
  | 'blueprint'
  | 'bauhaus'
  | 'pothi'
  | '1832'
  | 'sumi'
  | 'terminal'
  | 'contrast'

export type Look = { id: LookId; name: string; feel: string; dark: boolean }

export const LOOKS: Look[] = [
  { id: 'chalk', name: 'Chalkboard', feel: 'Lecture hall at night, chalk on slate', dark: true },
  { id: 'notebook', name: 'Lab notebook', feel: 'Graph paper, fountain-pen ink, red margin', dark: false },
  { id: 'blueprint', name: 'Blueprint', feel: 'Drafting table, cyan construction lines', dark: true },
  { id: 'bauhaus', name: 'Bauhaus', feel: 'Flat primaries and hard edges, as Rubik taught', dark: false },
  { id: 'pothi', name: 'Pothi', feel: 'Palm-leaf manuscript, madder red and indigo', dark: false },
  { id: '1832', name: '1832', feel: "Sepia ink on laid paper, like Galois's last letter", dark: false },
  { id: 'sumi', name: 'Sumi', feel: 'Ink wash on rice paper with one red seal', dark: false },
  { id: 'terminal', name: 'Terminal', feel: 'Phosphor screen, monospaced everything', dark: true },
  { id: 'contrast', name: 'High contrast', feel: 'Maximum legibility, no decoration', dark: true },
]

export const lookById = (id: LookId): Look => LOOKS.find((l) => l.id === id) ?? LOOKS[0]
