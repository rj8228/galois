/*
 * Gravity: downhill masks for the symmetry-reduced tables (speed lab T3, issue #23).
 *
 * Included at the end of grav3.c (a copy of lab/3x3/src/cube3.c). Adds:
 *   grav3 masks <table>...                       build down/up masks into $CUBE3_TABLES
 *   grav3 maskcheck <floor> <positions>          check mapped masks against direct child lookups
 *   grav3 gsolve <floor> <scrambles> <maxnodes> <mode>
 *        mode 0: lab/3x3's dfs() unchanged (the baseline)
 *        mode 1: down-only masks, one uint32 per entry
 *        mode 2: full masks (down and up), two uint32 per entry
 *        mode 3: down-only masks packed in 18 bits per entry
 *
 * A table's down mask at entry e holds the moves m whose neighbour (in the table's own graph) has
 * value(e) - 1; the up mask those with value(e) + 1. A move changes any table value by at most 1.
 *
 * The search reads a symmetry table at x through a frame Z = S_t Y S_t^-1, where Y = S_a x S_a^-1
 * is x seen along axis a (a = 0 for corners) and t the class symmetry of Y's raw coordinate. The
 * index stands for Z (raw coordinate = the class representative, twist conjugated by t), and the
 * mask is stored in Z's moves. Move m on x is move AXMOVE[a][m] on Y and SYMMOVE[t][AXMOVE[a][m]]
 * on Z, so the mask that applies to x is the stored one with its bits permuted by that map.
 */

#define MALL ((1u << 18) - 1)

typedef struct {
  const uint32_t *down, *up;
  uint8_t *down18; /* 18 bits per entry (entry e at bit 18 e), plus 4 bytes of padding */
} Mask;
static Mask MASKS[NTABLES];

/* PCH[a * 16 + t][c][v]: x-frame bits of the Z-frame bits v (6 bits) of chunk c. */
static uint32_t PCH[48][3][64];

static void init_pch(void) {
  /* GRAV3_WRONG_FRAME=1: conjugate the wrong way round (SYMINV[t]), to show that maskcheck catches it. */
  int wrong = getenv("GRAV3_WRONG_FRAME") != NULL;
  for (int a = 0; a < 3; a++)
    for (int t = 0; t < 16; t++) {
      int inv[18], tt = wrong ? SYMINV[t] : t;
      for (int m = 0; m < 18; m++) inv[SYMMOVE[tt][AXMOVE[a][m]]] = m;
      for (int c = 0; c < 3; c++)
        for (int v = 0; v < 64; v++) {
          uint32_t r = 0;
          for (int b = 0; b < 6; b++)
            if (v & (1 << b)) r |= 1u << inv[c * 6 + b];
          PCH[a * 16 + t][c][v] = r;
        }
    }
}

static inline uint32_t map_mask(uint32_t m, int at) {
  return PCH[at][0][m & 63] | PCH[at][1][(m >> 6) & 63] | PCH[at][2][(m >> 12) & 63];
}

static char *mask_path(const Table *T, const char *kind) {
  static __thread char buf[512];
  snprintf(buf, sizeof buf, "%s/%s.%s.bin", TABLE_DIR, T->name, kind);
  return buf;
}

/* Value of the neighbour of entry e along move m (the first entry neighbours() lists for m). */
static inline uint64_t first_neighbour(const Table *T, uint64_t e, int m) {
  const SymCoord *sc = T->kind == K_CORNERS_SYM ? &CpermSym : &FlipSliceSym;
  uint32_t raw = sc->rep[e / NTWIST], r2;
  int t = (int)(e % NTWIST);
  if (T->kind == K_CORNERS_SYM)
    r2 = CpermMove[raw][m];
  else
    r2 = (uint32_t)SliceMove[raw / NFLIP][m] * NFLIP + FlipMove[raw % NFLIP][m];
  return (uint64_t)sc->cls[r2] * NTWIST + TwistConj[TwistMove[t][m]][sc->sym[r2]];
}

static int cmd_masks(int argc, char **argv) {
  for (int a = 0; a < argc; a++) {
    Table *T = table_by_name(argv[a]);
    if (!T || (T->kind != K_CORNERS_SYM && T->kind != K_PHASE1_SYM)) die("masks: only corners_sym, phase1_sym");
    load_table(T, 4);
    double t0 = now();
    uint64_t n = T->n, bad = 0, ndown = 0, nup = 0;
    uint32_t *down = malloc(n * 4), *up = malloc(n * 4);
    if (!down || !up) die("out of memory");
#pragma omp parallel for schedule(dynamic, 1 << 16) reduction(+ : bad, ndown, nup)
    for (uint64_t e = 0; e < n; e++) {
      int v = get4(T, e);
      uint32_t d = 0, u = 0;
      for (int m = 0; m < 18; m++) {
        int w = get4(T, first_neighbour(T, e, m));
        if (w == v - 1) d |= 1u << m;
        else if (w == v + 1) u |= 1u << m;
        else if (w != v) bad++;
      }
      down[e] = d, up[e] = u;
      ndown += (uint64_t)__builtin_popcount(d);
      nup += (uint64_t)__builtin_popcount(u);
    }
    double secs = now() - t0;
    if (bad) die("a move changed a table value by more than 1");
    write_file(mask_path(T, "down32"), down, n * 4);
    write_file(mask_path(T, "up32"), up, n * 4);
    double wsecs = now() - t0 - secs;
    char jp[512];
    snprintf(jp, sizeof jp, "%s/%s.masks.json", TABLE_DIR, T->name);
    FILE *f = fopen(jp, "w");
    fprintf(f,
            "{\"table\": \"%s\", \"entries\": %llu, \"build_seconds\": %.2f, \"write_seconds\": %.2f, \"threads\": %d, "
            "\"mean_down_moves\": %.4f, \"mean_up_moves\": %.4f, \"bytes_down32\": %llu, \"bytes_down18\": %llu}\n",
            T->name, (unsigned long long)n, secs, wsecs, omp_get_max_threads(), (double)ndown / (double)n,
            (double)nup / (double)n, (unsigned long long)(n * 4), (unsigned long long)((n * 18 + 7) / 8));
    fclose(f);
    fprintf(stderr, "masks %s: %llu entries in %.1fs (+%.1fs write), %.2f down / %.2f up moves per entry\n", T->name,
            (unsigned long long)n, secs, wsecs, (double)ndown / (double)n, (double)nup / (double)n);
    free(down);
    free(up);
  }
  return 0;
}

static void load_masks(Table *T, int mode) {
  Mask *M = &MASKS[T - TABLES];
  size_t n = (size_t)T->n;
  if (!M->down) M->down = (const uint32_t *)map_file(mask_path(T, "down32"), n * 4);
  if (mode == 2 && !M->up) M->up = (const uint32_t *)map_file(mask_path(T, "up32"), n * 4);
  if (mode == 3 && !M->down18) {
    M->down18 = calloc((n * 18 + 7) / 8 + 4, 1);
    for (size_t e = 0; e < n; e++) {
      uint64_t d = (uint64_t)M->down[e] << ((e * 18) & 7);
      uint8_t *p = M->down18 + ((e * 18) >> 3);
      for (int b = 0; b < 4; b++) p[b] |= (uint8_t)(d >> (8 * b));
    }
    munmap((void *)M->down, n * 4);
    M->down = NULL;
  }
}

static inline int masked_lookup(const Lookup *L) {
  return !L->inv && L->axis >= 0 && L->bits == 4 && (L->T->kind == K_CORNERS_SYM || L->T->kind == K_PHASE1_SYM);
}

/* Index of a masked lookup and its frame (a * 16 + t), from the carried coordinates. */
static inline uint64_t mlookup(const Lookup *L, const Coords *co, int *at) {
  int a = L->axis;
  if (L->T->kind == K_CORNERS_SYM) {
    int t = CpermSym.sym[co->cp];
    *at = t;
    return (uint64_t)CpermSym.cls[co->cp] * NTWIST + TwistConj[co->tw[0]][t];
  }
  uint32_t r = (uint32_t)co->sl[a] * NFLIP + co->fl[a];
  int t = FlipSliceSym.sym[r];
  *at = a * 16 + t;
  return (uint64_t)FlipSliceSym.cls[r] * NTWIST + TwistConj[co->tw[a]][t];
}

static inline uint32_t read_down(const Mask *M, uint64_t e) {
  if (M->down) return M->down[e];
  uint32_t v;
  memcpy(&v, M->down18 + ((e * 18) >> 3), 4);
  return (v >> ((e * 18) & 7)) & MALL;
}

static inline void prefetch_mask(const Mask *M, uint64_t e, int up) {
  if (up) __builtin_prefetch(&M->up[e]);
  else if (M->down) __builtin_prefetch(&M->down[e]);
  else __builtin_prefetch(M->down18 + ((e * 18) >> 3));
}

/* ---------------------------------------------------------- mask check */

static int cmd_maskcheck(int argc, char **argv) {
  if (argc < 2) die("usage: grav3 maskcheck <floor> <positions>");
  Floor F;
  parse_floor(argv[0], &F);
  int nml = 0, ml[8];
  for (int l = 0; l < F.nl; l++)
    if (masked_lookup(&F.L[l])) {
      ml[nml++] = l;
      load_masks(F.L[l].T, 2);
    }
  long np = atol(argv[1]);
  uint64_t checked = 0, bad_idx = 0, bad_down = 0, bad_up = 0, ndown = 0;
  int nth = omp_get_max_threads();
#pragma omp parallel reduction(+ : checked, bad_idx, bad_down, bad_up, ndown)
  {
    uint64_t st = 0x1234567ull + 977ull * (uint64_t)omp_get_thread_num();
#pragma omp for schedule(dynamic, 1024)
    for (long p = 0; p < np; p++) {
      /* Half uniformly random positions, half random walks of 0-14 moves (low table values). */
      Cube x;
      if (p & 1) {
#pragma omp critical
        random_cube(&x);
      } else {
        x = SOLVED;
        st = st * 6364136223846793005ull + 1442695040888963407ull;
        int len = (int)((st >> 33) % 15);
        for (int k = 0; k < len; k++) {
          st = st * 6364136223846793005ull + 1442695040888963407ull;
          Cube y;
          mul(&x, &MV[(st >> 33) % 18], &y);
          x = y;
        }
      }
      Coords co;
      coords_of(&x, &co);
      for (int k = 0; k < nml; k++) {
        const Lookup *L = &F.L[ml[k]];
        const Mask *M = &MASKS[L->T - TABLES];
        int at;
        uint64_t e = mlookup(L, &co, &at);
        bad_idx += e != lookup_index_slow(L, &x);
        int v = get4(L->T, e);
        uint32_t d = map_mask(M->down[e], at), u = map_mask(M->up[e], at);
        ndown += (uint64_t)__builtin_popcount(d);
        for (int m = 0; m < 18; m++) {
          Cube y;
          mul(&x, &MV[m], &y);
          int w = get4(L->T, lookup_index_slow(L, &y));
          bad_down += ((d >> m) & 1) != (w == v - 1);
          bad_up += ((u >> m) & 1) != (w == v + 1);
          checked++;
        }
      }
    }
  }
  printf("{\"floor\": \"%s\", \"positions\": %ld, \"masked_lookups\": %d, \"child_checks\": %llu, \"bad_index\": %llu, "
         "\"bad_down\": %llu, \"bad_up\": %llu, \"mean_down_moves\": %.4f, \"threads\": %d}\n",
         F.name, np, nml, (unsigned long long)checked, (unsigned long long)bad_idx, (unsigned long long)bad_down,
         (unsigned long long)bad_up, (double)ndown / (double)(np * nml), nth);
  return bad_idx || bad_down || bad_up;
}

/* ------------------------------------------------------- masked IDA* */

typedef struct {
  Search S; /* the baseline's search state (nodes = generated children, as in lab/3x3) */
  int mode;
  int nml, ml[8], mk[96]; /* masked lookups: their lookup numbers; mk[l] = k or -1 */
  const Mask *mm[8];
  uint64_t skipped, mask_reads;
} GSearch;

/* As dfs(), plus: at every node, each masked lookup at the bound (rem) must go down, so only the
 * moves in the AND of their mapped down masks can give a child with floor <= rem - 1. In full mode
 * each masked lookup at rem - 1 must also not go up. Other children are not generated at all.
 * midx/mat: x's index and frame for each masked lookup (computed when x was generated). */
static int gdfs(GSearch *G, const Cube *x, const Coords *cx, int g, int rem, int lastf, const int *hv,
                const uint64_t *midx, const int *mat) {
  Search *S = &G->S;
  if (rem == 0) return same(x, &SOLVED);
  int nm = g == 0 ? S->nroot : 18;
  if (rem == 1) {
    for (int mi = 0; mi < nm; mi++) {
      int m = g == 0 ? S->root_moves[mi] : mi;
      if (skip_face(m / 3, lastf)) continue;
      Cube y;
      mul(x, &MV[m], &y);
      S->nodes++;
      if (same(&y, &SOLVED)) {
        S->path[g] = m;
        return 1;
      }
    }
    return 0;
  }
  const Floor *F = S->F;
  uint32_t allow = MALL;
  for (int k = 0; k < G->nml; k++) {
    int l = G->ml[k];
    if (hv[l] == rem) {
      allow &= map_mask(read_down(G->mm[k], midx[k]), mat[k]);
      G->mask_reads++;
    } else if (G->mode == 2 && hv[l] == rem - 1) {
      allow &= ~map_mask(G->mm[k]->up[midx[k]], mat[k]);
      G->mask_reads++;
    }
  }
  Cube ys[18];
  Coords cs[18];
  NodeCache ncs[18];
  int ms[18], nc = 0, hv2[18][96], cat[18][8];
  uint64_t cidx[18][8];
  for (int mi = 0; mi < nm; mi++) {
    int m = g == 0 ? S->root_moves[mi] : mi;
    if (skip_face(m / 3, lastf)) continue;
    if (!((allow >> m) & 1)) {
      G->skipped++;
      continue;
    }
    mul(x, &MV[m], &ys[nc]);
    coords_move(cx, m, &cs[nc], F->axmask);
    ncs[nc].x = &ys[nc], ncs[nc].have_inv = 0, ncs[nc].have_pos[0] = ncs[nc].have_pos[1] = 0, ncs[nc].ncj = 0;
    ms[nc++] = m;
  }
  S->nodes += (uint64_t)nc;
  int alive[18], na = nc;
  for (int i = 0; i < nc; i++) alive[i] = i;
  for (int gi = 0; gi < F->ng && na; gi++) {
    int lo = F->gs[gi], hi = F->gs[gi + 1], w = 0;
    uint64_t gidx[18][48];
    for (int a = 0; a < na; a++) {
      int i = alive[a];
      for (int l = lo; l < hi; l++) {
        int k = G->mk[l];
        if (k >= 0)
          gidx[a][l - lo] = cidx[i][k] = mlookup(&F->L[l], &cs[i], &cat[i][k]);
        else
          gidx[a][l - lo] = lookup_index_c(&F->L[l], &ncs[i], &cs[i]);
        prefetch_entry(&F->L[l], gidx[a][l - lo]);
      }
    }
    for (int a = 0; a < na; a++) {
      int i = alive[a], ok = 1;
      for (int l = lo; l < hi; l++) {
        int v = entry_value(&F->L[l], gidx[a][l - lo], hv[l]);
        if (v > rem - 1) {
          ok = 0;
          break;
        }
        hv2[i][l] = v;
      }
      if (ok) alive[w++] = i;
    }
    na = w;
  }
  /* Survivors will read their masks first thing: fetch them now. */
  if (rem - 1 >= 2)
    for (int a = 0; a < na; a++) {
      int i = alive[a];
      for (int k = 0; k < G->nml; k++) {
        int v = hv2[i][G->ml[k]];
        if (v == rem - 1) prefetch_mask(G->mm[k], cidx[i][k], 0);
        else if (G->mode == 2 && v == rem - 2) prefetch_mask(G->mm[k], cidx[i][k], 1);
      }
    }
  for (int a = 0; a < na; a++) {
    int i = alive[a];
    S->path[g] = ms[i];
    if (gdfs(G, &ys[i], &cs[i], g + 1, rem - 1, next_lastf(S, g, ms[i] / 3), hv2[i], cidx[i], cat[i])) return 1;
    if (S->nodes > S->maxnodes) {
      S->aborted = 1;
      return 0;
    }
    if (S->stop && *S->stop) return 0;
  }
  return 0;
}

typedef struct {
  Result R;
  uint64_t skipped, mask_reads, skipped_per_bound[32];
} GResult;

static void gtask_start(const GSearch *G, const Coords *co, uint64_t *midx, int *mat) {
  for (int k = 0; k < G->nml; k++) midx[k] = mlookup(&G->S.F->L[G->ml[k]], co, &mat[k]);
}

/* solve() with gdfs(); same rounds, same split mode. */
static void gsolve(const Floor *F, int mode, const Cube *x, uint64_t maxnodes, GResult *GR, int split) {
  GSearch G;
  memset(&G, 0, sizeof G);
  memset(GR, 0, sizeof *GR);
  Result *R = &GR->R;
  Search *S = &G.S;
  S->F = F;
  S->maxnodes = maxnodes;
  G.mode = mode;
  for (int l = 0; l < F->nl; l++) {
    G.mk[l] = -1;
    if (masked_lookup(&F->L[l])) {
      G.mm[G.nml] = &MASKS[F->L[l].T - TABLES];
      G.mk[l] = G.nml;
      G.ml[G.nml++] = l;
    }
  }
  double t0 = now();
  R->nstab = root_symmetry(S, x);
  int hv[96] = {0};
  floor_values(F, x, hv);
  Coords cx;
  coords_of(x, &cx);
  uint64_t midx[8];
  int mat[8];
  gtask_start(&G, &cx, midx, mat);
  int h = 0;
  for (int l = 0; l < F->nl; l++)
    if (hv[l] > h) h = hv[l];
  R->h0 = h;
  R->length = -1;
  for (int bound = h; bound <= 26; bound++) {
    uint64_t before = S->nodes, sk0 = G.skipped;
    int found;
    if (split && bound > split + 1) {
      int cap = 1024, nt = 0, path[8] = {0};
      Task *tasks = malloc(sizeof(Task) * (size_t)cap);
      collect(S, x, &cx, 0, split, bound, -1, hv, path, &tasks, &nt, &cap);
      volatile int stop = 0;
      uint64_t sub = 0, subsk = 0, subrd = 0, budget = maxnodes > S->nodes ? maxnodes - S->nodes : 0;
      int winner = -1, aborted = 0, wpath[32];
#pragma omp parallel for schedule(dynamic, 1) reduction(+ : sub, subsk, subrd) reduction(| : aborted)
      for (int t = 0; t < nt; t++) {
        if (stop) continue;
        GSearch T = G;
        T.S.nodes = 0, T.S.stop = &stop, T.S.maxnodes = budget, T.skipped = 0, T.mask_reads = 0;
        memcpy(T.S.path, tasks[t].path, sizeof tasks[t].path);
        uint64_t ti[8];
        int ta[8];
        gtask_start(&T, &tasks[t].co, ti, ta);
        int ok = gdfs(&T, &tasks[t].c, &tasks[t].co, split, bound - split, tasks[t].lastf, tasks[t].hv, ti, ta);
        sub += T.S.nodes, subsk += T.skipped, subrd += T.mask_reads;
        aborted |= T.S.aborted;
        if (ok) {
#pragma omp critical
          if (winner < 0) {
            winner = t;
            memcpy(wpath, T.S.path, sizeof wpath);
            stop = 1;
          }
        }
      }
      free(tasks);
      S->nodes += sub, G.skipped += subsk, G.mask_reads += subrd;
      found = winner >= 0;
      if (found) memcpy(S->path, wpath, sizeof wpath);
      if (!found && (aborted || S->nodes > maxnodes)) S->aborted = 1;
    } else {
      found = gdfs(&G, x, &cx, 0, bound, -1, hv, midx, mat);
    }
    R->per_bound[bound] = S->nodes - before;
    GR->skipped_per_bound[bound] = G.skipped - sk0;
    if (found) {
      R->length = bound;
      memcpy(R->path, S->path, sizeof S->path);
      break;
    }
    if (S->aborted) break;
  }
  R->nodes = S->nodes;
  R->aborted = S->aborted;
  R->secs = now() - t0;
  GR->skipped = G.skipped;
  GR->mask_reads = G.mask_reads;
}

static int cmd_gsolve(int argc, char **argv) {
  if (argc < 4) die("usage: grav3 gsolve <floor> <scrambles.txt> <maxnodes> <mode 0-3>");
  Floor F;
  double tl = now();
  parse_floor(argv[0], &F);
  double load_s = now() - tl;
  uint64_t maxnodes = strtoull(argv[2], NULL, 10);
  int mode = atoi(argv[3]);
  int split = getenv("CUBE3_SPLIT") ? atoi(getenv("CUBE3_SPLIT")) : 0;
  size_t mask_bytes = 0;
  double tm = now();
  if (mode)
    for (int l = 0; l < F.nl; l++)
      if (masked_lookup(&F.L[l])) {
        Table *T = F.L[l].T;
        int dup = 0;
        for (int j = 0; j < l; j++) dup |= F.L[j].T == T;
        load_masks(T, mode);
        if (!dup) mask_bytes += mode == 3 ? ((size_t)T->n * 18 + 7) / 8 : (size_t)T->n * (mode == 2 ? 8 : 4);
      }
  double mask_load_s = now() - tm;
  FILE *f = fopen(argv[1], "r");
  if (!f) die("cannot open scramble file");
  char line[1024];
  char *lines[1024];
  int n = 0;
  while (fgets(line, sizeof line, f) && n < 1024) {
    line[strcspn(line, "\r\n")] = 0;
    if (!line[0] || line[0] == '#') continue;
    lines[n++] = strdup(line);
  }
  fclose(f);
  size_t aux, bytes = floor_bytes(&F, &aux);
  printf("{\"type\": \"meta\", \"floor\": \"%s\", \"mode\": %d, \"lookups\": %d, \"bytes\": %zu, \"aux_bytes\": %zu, "
         "\"mask_bytes\": %zu, \"load_seconds\": %.3f, \"mask_load_seconds\": %.3f, \"threads\": %d, \"split\": %d, "
         "\"maxnodes\": %llu}\n",
         F.name, mode, F.nl, bytes, aux, mask_bytes, load_s, mask_load_s, omp_get_max_threads(), split,
         (unsigned long long)maxnodes);
  fflush(stdout);
#pragma omp parallel for schedule(dynamic, 1) if (!split)
  for (int i = 0; i < n; i++) {
    int mv[64];
    int k = parse_moves(lines[i], mv);
    if (k < 0) die("bad scramble");
    Cube c = SOLVED, z;
    apply(&c, mv, k);
    GResult GR;
    if (mode == 0) {
      memset(&GR, 0, sizeof GR);
      solve(&F, &c, maxnodes, &GR.R, split);
    } else {
      gsolve(&F, mode, &c, maxnodes, &GR, split);
    }
    Result *R = &GR.R;
    z = c;
    int ok = R->length >= 0;
    if (ok) apply(&z, R->path, R->length);
    ok = ok && same(&z, &SOLVED);
    char sol[256] = "";
    for (int j = 0; j < R->length; j++) {
      strcat(sol, MOVENAME[R->path[j]]);
      if (j + 1 < R->length) strcat(sol, " ");
    }
#pragma omp critical
    {
      printf("{\"type\": \"solve\", \"index\": %d, \"scramble\": \"%s\", \"length\": %d, \"solution\": \"%s\", ", i,
             lines[i], R->length, sol);
      printf("\"verified\": %s, \"dnf\": %s, \"h0\": %d, \"nodes\": %llu, \"skipped\": %llu, \"mask_reads\": %llu, "
             "\"seconds\": %.4f, ",
             ok ? "true" : "false", R->aborted ? "true" : "false", R->h0, (unsigned long long)R->nodes,
             (unsigned long long)GR.skipped, (unsigned long long)GR.mask_reads, R->secs);
      printf("\"nodes_per_bound\": {");
      int first = 1;
      for (int b = 0; b < 32; b++)
        if (R->per_bound[b] || GR.skipped_per_bound[b])
          printf("%s\"%d\": [%llu, %llu]", first ? "" : ", ", b, (unsigned long long)R->per_bound[b],
                 (unsigned long long)GR.skipped_per_bound[b]),
              first = 0;
      printf("}}\n");
      fflush(stdout);
      fprintf(stderr, "  #%d len %d nodes %llu skipped %llu %.3fs%s\n", i, R->length, (unsigned long long)R->nodes,
              (unsigned long long)GR.skipped, R->secs, R->aborted ? " DNF" : "");
    }
  }
  return 0;
}
