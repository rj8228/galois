import type { ComponentChildren } from 'preact'
import type { Parsed } from '../cube/notation.ts'
import type { Analysis } from '../engine/analysis.ts'

/** What a step's check can look at. */
export type StepContext = {
  /** Moves made since the step began (the cube is reset to solved when a step asks for it). */
  history: string[]
  /** True when the cube on the stage is solved. */
  solved: boolean
  /** The sequence box, parsed. */
  sequence: Parsed
  /** Analysis of the sequence box, when it is valid. */
  analysis: Analysis | null
  /** Labels of the action buttons pressed in this step. */
  actions: Set<string>
  /** Analyses any sequence, such as the sequence box combined with a given one. */
  analyse: (text: string) => Analysis | null
}

export type StepKind = 'do' | 'notice' | 'name' | 'explore' | 'prove'

export type Choice = { text: string; correct: boolean; feedback: string }

export type Action = { label: string; run: () => void }

export type Step = {
  kind: StepKind
  title: string
  body: ComponentChildren
  /** Reset the cube to solved when the step opens. */
  fromSolved?: boolean
  /** Put this text in the sequence box when the step opens. */
  load?: string
  /** The task, shown with a live tick once `done` is true. */
  task?: string
  done?: (ctx: StepContext) => boolean
  /** Shown once done. */
  success?: string
  choices?: Choice[]
  actions?: Action[]
  /** Show the analysis panel inside the step. */
  analysis?: boolean
  hint?: string
  /** The formal layer: the same idea in the language of group theory. */
  formal?: ComponentChildren
}

export type Lesson = {
  id: string
  number: number
  title: string
  concept: string
  summary: string
  steps: Step[]
}
