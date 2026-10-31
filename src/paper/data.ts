/**
 * Results from the Galois solver lab (2×2, half-turn metric), quoted in the Paper tab.
 * The lab built the exact distance of every position and measured each idea against it, either
 * on all 3,674,160 positions or on the same 1,000 positions drawn uniformly at random.
 * Figures are copied from that run as reported; the app does not recompute them.
 */

/** Floors: memory, average floor over all positions, how often it equals the truth, and search work. */
export const FLOOR_TABLE: {
  name: string
  memory: string
  mean: number | null
  exact: string
  nodes: number | null
  /** Plotted in the work-against-floor figure. */
  plot?: string
}[] = [
  { name: 'No floor', memory: 'nothing', mean: 0, exact: '–', nodes: 18_139_852 },
  { name: 'Twists only', memory: '729 entries', mean: 4.44, exact: '0.1%', nodes: 214_344, plot: 'Twists only' },
  { name: 'Places only', memory: '5,040 entries', mean: 4.86, exact: '0.4%', nodes: 90_238, plot: 'Places only' },
  { name: 'Best tables', memory: '2 KB', mean: 4.84, exact: '0.2%', nodes: 18_609, plot: '2 KB' },
  { name: 'Best tables', memory: '20 KB', mean: 5.93, exact: '1.4%', nodes: 2_319, plot: '20 KB' },
  { name: 'Best tables', memory: '100 KB', mean: 6.77, exact: '7.1%', nodes: 627, plot: '100 KB' },
  { name: 'Best tables', memory: '400 KB', mean: 7.69, exact: '31.7%', nodes: 162, plot: '400 KB' },
  { name: 'Exact table', memory: '1.8 MB', mean: 8.76, exact: '100%', nodes: null },
]

/** One network shape (70 inputs, two hidden layers of 128, one output), trained five ways, checked on every position. */
export const NETWORKS = [
  {
    name: 'A',
    data: 'random scrambles',
    labels: 'scramble length',
    tooHigh: '68.3%',
    note: 'learns near solved, overestimates far out',
  },
  {
    name: 'B',
    data: 'uniform positions',
    labels: 'true distance',
    tooHigh: '31.4%',
    note: 'collapsed: answers about 8.7 for everything',
  },
  {
    name: 'C',
    data: 'uniform positions',
    labels: 'true, overestimates ×30',
    tooHigh: '1.47%',
    note: 'exact with 54,131 corrections (268 KB)',
  },
  {
    name: 'D',
    data: 'random scrambles',
    labels: 'true distance',
    tooHigh: '9.4%',
    note: 'learns near solved; the finder in §7.8',
  },
  {
    name: 'E',
    data: 'random scrambles',
    labels: 'true, overestimates ×30',
    tooHigh: '0.04%',
    note: 'exact with 1,415 corrections (57 KB)',
  },
]

/** IDA* guided by estimates that can be too high: at most 20,000 positions per solve, on 300 positions. */
export const OVERESTIMATES = [
  { name: 'Network A', optimal: '19.7%', tooLong: '71.7%', gaveUp: '8.7%' },
  { name: 'Network B', optimal: '0.3%', tooLong: '0%', gaveUp: '99.7%' },
  { name: 'Network C', optimal: '8.7%', tooLong: '0%', gaveUp: '91.3%' },
  { name: 'Network C + corrections', optimal: '100%', tooLong: '0%', gaveUp: '0%' },
]

/** Rolling a ball downhill on each landscape, from 1,000 random positions (300 steps at most). */
export const GRAVITY = [
  { name: 'True distance', valleys: '0%', reached: '100%', heat: '82%' },
  { name: 'Floor: twists only', valleys: '0.14%', reached: '0%', heat: '0.6%' },
  { name: 'Floor: best tables, 400 KB', valleys: '19%', reached: '18%', heat: '37%' },
  { name: 'Network D', valleys: '4.6%', reached: '4.2%', heat: '7.2%' },
]

/** Network D's beam search as the ceiling, the 400 KB tables as the floor, IDA* as the prover; 1,000 positions. */
export const FRAMEWORK = {
  found: '67%',
  optimal: '58%',
  instant: '26.5%',
  nodesAlone: 162,
  nodesWithCeiling: 123,
  workCut: '24%',
}

/**
 * God's number for the 3×3 (half-turn metric): the best proven bounds after each result, from
 * cube20.org. `year` places the result on the time axis (month as a fraction). The first row is the
 * counting argument, which gave the lower bound of 18 before 1980; no upper bound existed yet.
 */
export const GODS_NUMBER_BOUNDS: {
  date: string
  year: number
  lower: number
  upper: number | null
  who: string
}[] = [
  { date: 'by 1980', year: 1980, lower: 18, upper: null, who: 'Counting move sequences' },
  { date: 'Jul 1981', year: 1981.5, lower: 18, upper: 52, who: 'Morwen Thistlethwaite' },
  { date: 'Dec 1990', year: 1990.92, lower: 18, upper: 42, who: 'Hans Kloosterman' },
  { date: 'May 1992', year: 1992.37, lower: 18, upper: 39, who: 'Michael Reid' },
  { date: 'May 1992', year: 1992.37, lower: 18, upper: 37, who: 'Dik Winter' },
  { date: 'Jan 1995', year: 1995.04, lower: 18, upper: 29, who: "Michael Reid, with Kociemba's two-phase algorithm" },
  { date: 'Jan 1995', year: 1995.04, lower: 20, upper: 29, who: 'Michael Reid: the superflip needs 20' },
  { date: 'Dec 2005', year: 2005.92, lower: 20, upper: 28, who: 'Silviu Radu' },
  { date: 'Apr 2006', year: 2006.29, lower: 20, upper: 27, who: 'Silviu Radu' },
  { date: 'May 2007', year: 2007.37, lower: 20, upper: 26, who: 'Dan Kunkle and Gene Cooperman' },
  { date: 'Mar 2008', year: 2008.21, lower: 20, upper: 25, who: 'Tomas Rokicki' },
  { date: 'Apr 2008', year: 2008.29, lower: 20, upper: 23, who: 'Tomas Rokicki and John Welborn' },
  { date: 'Aug 2008', year: 2008.62, lower: 20, upper: 22, who: 'Tomas Rokicki and John Welborn' },
  {
    date: 'Jul 2010',
    year: 2010.54,
    lower: 20,
    upper: 20,
    who: 'Tomas Rokicki, Herbert Kociemba, Morley Davidson and John Dethridge',
  },
]

export type Reference = { key: string; text: string; url?: string }

export const REFERENCES: Reference[] = [
  {
    key: 'Agostinelli et al. 2019',
    text: "Agostinelli, F., McAleer, S., Shmakov, A. and Baldi, P. (2019). Solving the Rubik's cube with deep reinforcement learning and search. Nature Machine Intelligence 1, 356–363.",
    url: 'https://doi.org/10.1038/s42256-019-0070-z',
  },
  {
    key: 'Chervov et al. 2025',
    text: "Chervov, A., Khoruzhii, K., Bukhal, N. et al. (2025). A machine learning approach that beats large Rubik's cubes. arXiv:2502.13266.",
    url: 'https://arxiv.org/abs/2502.13266',
  },
  {
    key: 'Demaine et al. 2011',
    text: "Demaine, E. D., Demaine, M. L., Eisenstat, S., Lubiw, A. and Winslow, A. (2011). Algorithms for solving Rubik's cubes. ESA 2011.",
    url: 'https://arxiv.org/abs/1106.5736',
  },
  {
    key: 'Demaine et al. 2018',
    text: "Demaine, E. D., Eisenstat, S. and Rudoy, M. (2018). Solving the Rubik's Cube optimally is NP-complete. STACS 2018.",
    url: 'https://arxiv.org/abs/1706.06708',
  },
  {
    key: 'Futuhi and Sturtevant 2026',
    text: 'Futuhi, E. and Sturtevant, N. R. (2026). Learning admissible heuristics for A*: theory and practice. ICLR 2026.',
    url: 'https://arxiv.org/abs/2509.22626',
  },
  {
    key: 'Hart et al. 1968',
    text: 'Hart, P. E., Nilsson, N. J. and Raphael, B. (1968). A formal basis for the heuristic determination of minimum cost paths. IEEE Transactions on Systems Science and Cybernetics 4(2), 100–107.',
  },
  {
    key: 'Korf 1985',
    text: 'Korf, R. E. (1985). Depth-first iterative-deepening: an optimal admissible tree search. Artificial Intelligence 27(1), 97–109.',
  },
  {
    key: 'Korf 1997',
    text: "Korf, R. E. (1997). Finding optimal solutions to Rubik's Cube using pattern databases. AAAI 1997.",
    url: 'https://mlanthology.org/aaai/1997/korf1997aaai-finding',
  },
  {
    key: 'Pan and Kondor 2021',
    text: 'Pan, H. and Kondor, R. (2021). Fourier bases for solving permutation puzzles. AISTATS 2021.',
    url: 'https://mlanthology.org/aistats/2021/pan2021aistats-fourier',
  },
  {
    key: 'Rokicki et al. 2010',
    text: "Rokicki, T., Kociemba, H., Davidson, M. and Dethridge, J. (2010). God's number is 20.",
    url: 'https://cube20.org/',
  },
  {
    key: 'Samadi et al. 2008',
    text: 'Samadi, M., Siabani, M., Felner, A. and Holte, R. (2008). Compressing pattern databases with learning. ECAI 2008.',
    url: 'https://webdocs.cs.ualberta.ca/~holte/Publications/ecai08.pdf',
  },
]
