import type { Route } from './router.ts'

/** The app's sections, in one list so the navigation and the Home tiles always match. */
export const SECTIONS: { id: Route; label: string; text: string; icon: string }[] = [
  {
    id: 'learn',
    label: 'Learn',
    text: 'Group theory, one thing you do on the cube at a time.',
    icon: 'M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z',
  },
  {
    id: 'labs',
    label: 'Labs',
    text: 'Open challenges, checked live as you type.',
    icon: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M7.5 14h9',
  },
  {
    id: 'play',
    label: 'Play',
    text: 'Turn the cube freely, play sequences, step through them.',
    icon: 'M5 8l7-4 7 4v8l-7 4-7-4zM5 8l7 4 7-4M12 12v8',
  },
  {
    id: 'daily',
    label: 'Daily',
    text: 'Solve of the Day: one scramble for everyone. Speed and fewest moves.',
    icon: 'M5 6h14v14H5zM5 10h14M9 3v4M15 3v4M9 14h2v2H9z',
  },
  {
    id: 'decode',
    label: 'Decode',
    text: 'Famous algorithms taken apart, piece by piece.',
    icon: 'M10 4a6 6 0 1 0 0 12a6 6 0 1 0 0-12M15 15l5 5',
  },
]
