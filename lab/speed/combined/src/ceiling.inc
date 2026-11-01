/*
 * T6 ceiling race. Included into race.c, a copy of lab/3x3/src/cube3.c.
 *
 *   race ceil selftest                       phase-2 tables, solver replays on random positions
 *   race ceil duel <file> <capD> <capT>      per line "D scramble": target-D search and trace, JSON lines
 *   race ceil run <file> <mode> <k> <cap>    mode 1t | split | race: the prover alone, split over k threads,
 *                                            or k-1 prover threads racing one ceiling thread
 *
 * The two-phase solver: phase 1 reaches H = <U, D, R2, L2, F2, B2>, pruned by the exact phase-1 table
 * (phase1_sym) and optionally by the full desktop floor against the target. Phase 2 stays in H with two
 * new BFS tables (corner perm x slice perm, UD-edge perm x slice perm). Six variants (x, x^-1 along three
 * axes), interleaved by phase-1 length.
 */
#include <pthread.h>
#include <stdatomic.h>

#define NUDP 40320
#define NSP 24
static const int P2M[10] = {0, 1, 2, 4, 7, 9, 10, 11, 13, 16}; /* U U2 U' R2 F2 D D2 D' L2 B2 */
static uint16_t UDPMove[NUDP][10], CP2Move[NCPERM][10];
static uint8_t SPMove[NSP][10];
static uint8_t *PrunCS, *PrunUS;
static Table *P1T;
static Floor DESK;

static inline int udp_of(const Cube *c) { return (int)perm_rank(c->ep, 8); }
static inline int sp_of(const Cube *c) {
  uint8_t t[4];
  for (int i = 0; i < 4; i++) t[i] = (uint8_t)(c->ep[8 + i] - 8);
  return (int)perm_rank(t, 4);
}

static void bfs2(uint8_t *d, uint16_t (*A)[10]) {
  size_t n = (size_t)40320 * NSP;
  memset(d, 255, n);
  d[0] = 0;
  for (int depth = 0;; depth++) {
    size_t cnt = 0;
    for (size_t i = 0; i < n; i++) {
      if (d[i] != depth) continue;
      int a = (int)(i / NSP), s = (int)(i % NSP);
      for (int k = 0; k < 10; k++) {
        size_t j = (size_t)A[a][k] * NSP + SPMove[s][k];
        if (d[j] == 255) d[j] = (uint8_t)(depth + 1), cnt++;
      }
    }
    if (!cnt) break;
  }
  for (size_t i = 0; i < n; i++)
    if (d[i] == 255) die("phase-2 table has unreached entries");
}

static void ceil_init(void) {
  Cube c, d;
  for (int p = 0; p < NUDP; p++) {
    c = SOLVED;
    perm_unrank((uint32_t)p, c.ep, 8);
    if (udp_of(&c) != p) die("udp coordinate");
    for (int k = 0; k < 10; k++) {
      mul(&c, &MV[P2M[k]], &d);
      for (int i = 0; i < 8; i++)
        if (d.ep[i] >= 8) die("phase-2 move leaves H");
      UDPMove[p][k] = (uint16_t)udp_of(&d);
      CP2Move[p][k] = CpermMove[p][P2M[k]];
    }
  }
  for (int s = 0; s < NSP; s++) {
    c = SOLVED;
    uint8_t t[4];
    perm_unrank((uint32_t)s, t, 4);
    for (int i = 0; i < 4; i++) c.ep[8 + i] = (uint8_t)(8 + t[i]);
    if (sp_of(&c) != s) die("sp coordinate");
    for (int k = 0; k < 10; k++) {
      mul(&c, &MV[P2M[k]], &d);
      SPMove[s][k] = (uint8_t)sp_of(&d);
    }
  }
  PrunCS = malloc((size_t)40320 * NSP);
  PrunUS = malloc((size_t)40320 * NSP);
  bfs2(PrunCS, CP2Move);
  bfs2(PrunUS, UDPMove);
  parse_floor("C8s+P1x3i", &DESK);
  P1T = table_by_name("phase1_sym");
  load_table(P1T, 4);
}

static inline int p1h(int tw, int fl, int sl) {
  uint32_t r = (uint32_t)sl * NFLIP + (uint32_t)fl;
  return get4(P1T, (uint64_t)FlipSliceSym.cls[r] * NTWIST + TwistConj[tw][FlipSliceSym.sym[r]]);
}

/* 1 if some lookup of the floor exceeds lim. */
static int floor_exceeds(const Floor *F, const Cube *y, const Coords *co, int lim) {
  NodeCache nc;
  nc.x = y, nc.have_inv = 0, nc.have_pos[0] = nc.have_pos[1] = 0, nc.ncj = 0;
  for (int l = 0; l < F->nl; l++)
    if (get4(F->L[l].T, lookup_index_c(&F->L[l], &nc, co)) > lim) return 1;
  return 0;
}
static int floor_of(const Floor *F, const Cube *x) {
  int hv[96], h = 0;
  floor_values(F, x, hv);
  for (int l = 0; l < F->nl; l++)
    if (hv[l] > h) h = hv[l];
  return h;
}

/* ------------------------------------------------------------ ceiling */

typedef struct Ceil_ {
  const Cube *x;
  int fullfloor, trace, floor0, stop_at; /* stop_at: trace stops once a solution this short is found */
  _Atomic int target; /* look for solutions of length <= target */
  double t0, deadline;
  uint64_t nodes, next_check, p2calls;
  int stopped;
  int vinv, vaxis, a;
  int p1[32], p2[32];
  int best[32], bestlen;
  int nlog;
  double log_t[32];
  int log_len[32];
  uint64_t log_nodes[32];
  volatile int *stop;
  void (*on_found)(void *arg, int len);
  void *arg;
  int (*yield)(const struct Ceil_ *C); /* T7: stop the ceiling search to help the prover */
  int yielded;
} Ceil;

static void ceil_check(Ceil *C) {
  C->next_check = C->nodes + 20000;
  if (now() > C->deadline || (C->stop && *C->stop)) C->stopped = 1;
  else if (C->yield && C->yield(C)) C->stopped = 1, C->yielded = 1;
}

static int p2dfs(Ceil *C, int cp, int udp, int sp, int rem, int lastf, int d) {
  if (rem == 0) return cp == 0 && udp == 0 && sp == 0;
  for (int k = 0; k < 10; k++) {
    int m = P2M[k], f = m / 3;
    if (skip_face(f, lastf)) continue;
    int ncp = CP2Move[cp][k], nu = UDPMove[udp][k], ns = SPMove[sp][k];
    C->nodes++;
    int h = PrunCS[ncp * NSP + ns], h2 = PrunUS[nu * NSP + ns];
    if (h2 > h) h = h2;
    if (h > rem - 1) continue;
    C->p2[d] = m;
    if (p2dfs(C, ncp, nu, ns, rem - 1, f, d + 1)) return 1;
  }
  return 0;
}

static void ceil_record(Ceil *C, int a, int d) {
  int s = AXIS_SYM[C->vaxis], si = SYMINV[s], w[32], n = a + d, out[32];
  for (int i = 0; i < a; i++) w[i] = C->p1[i];
  for (int i = 0; i < d; i++) w[a + i] = C->p2[i];
  for (int i = 0; i < n; i++) w[i] = SYMMOVE[si][w[i]];
  if (C->vinv)
    for (int i = 0; i < n; i++) out[i] = (w[n - 1 - i] / 3) * 3 + 2 - w[n - 1 - i] % 3;
  else
    memcpy(out, w, sizeof(int) * (size_t)n);
  Cube z = *C->x;
  apply(&z, out, n);
  if (!same(&z, &SOLVED)) die("ceiling solution does not solve the position");
  C->bestlen = n;
  memcpy(C->best, out, sizeof(int) * (size_t)n);
  if (C->nlog < 32) {
    C->log_t[C->nlog] = now() - C->t0;
    C->log_len[C->nlog] = n;
    C->log_nodes[C->nlog] = C->nodes;
    C->nlog++;
  }
  if (C->on_found) C->on_found(C->arg, n);
}

/* Phase 2 from a phase-1 end y. Returns 1 to stop the whole search. */
static int ceil_phase2(Ceil *C, const Cube *y, int a, int lastf) {
  int cp = cperm_of(y), udp = udp_of(y), sp = sp_of(y);
  int h = PrunCS[cp * NSP + sp], h2 = PrunUS[udp * NSP + sp];
  if (h2 > h) h = h2;
  C->p2calls++;
  int maxd = atomic_load(&C->target) - a;
  for (int d = h; d <= maxd; d++) {
    if (p2dfs(C, cp, udp, sp, d, lastf, 0)) {
      ceil_record(C, a, d);
      if (!C->trace) return 1;
      atomic_store(&C->target, a + d - 1);
      if (a + d - 1 < C->floor0 || a + d <= C->stop_at) {
        C->stopped = 1;
        return 1;
      }
      return 0;
    }
  }
  return 0;
}

static int p1dfs(Ceil *C, const Cube *y, const Coords *co, int g, int rem, int lastf) {
  if (rem == 0) return ceil_phase2(C, y, g, lastf);
  int target = atomic_load(&C->target);
  if (g + rem > target) return 0;
  for (int m = 0; m < 18; m++) {
    int f = m / 3;
    if (skip_face(f, lastf)) continue;
    if (rem == 1 && (f == 0 || f == 3 || m % 3 == 1)) continue; /* last phase-1 move: R, L, F or B quarter turn */
    Coords c2;
    coords_move(co, m, &c2, 7);
    C->nodes++;
    if (p1h(c2.tw[0], c2.fl[0], c2.sl[0]) > rem - 1) continue;
    Cube y2;
    mul(y, &MV[m], &y2);
    if (C->fullfloor && floor_exceeds(&DESK, &y2, &c2, atomic_load(&C->target) - g - 1)) continue;
    C->p1[g] = m;
    if (p1dfs(C, &y2, &c2, g + 1, rem - 1, f)) return 1;
    if (C->nodes >= C->next_check) ceil_check(C);
    if (C->stopped) return 1;
    if (g + rem > atomic_load(&C->target)) return 0;
  }
  return 0;
}

/* Search for a solution of length <= target (trace: keep lowering the target after each one). */
static int ceiling_run(Ceil *C, const Cube *x, int target, double cap, int trace, int fullfloor) {
  C->x = x, C->trace = trace, C->fullfloor = fullfloor;
  atomic_store(&C->target, target);
  C->t0 = now(), C->deadline = C->t0 + cap;
  C->nodes = 0, C->next_check = 20000, C->p2calls = 0, C->stopped = 0, C->bestlen = -1, C->nlog = 0;
  C->floor0 = floor_of(&DESK, x);
  Cube base[2], ys[6];
  Coords cs[6];
  int h1[6], amin = 99;
  base[0] = *x;
  inverse(x, &base[1]);
  for (int v = 0; v < 6; v++) {
    sym_conj(&base[v / 3], AXIS_SYM[v % 3], &ys[v]);
    coords_of(&ys[v], &cs[v]);
    h1[v] = p1h(cs[v].tw[0], cs[v].fl[0], cs[v].sl[0]);
    if (h1[v] < amin) amin = h1[v];
  }
  if (target < C->floor0) return -1;
  for (int a = amin; a <= atomic_load(&C->target) && !C->stopped; a++) {
    for (int v = 0; v < 6 && !C->stopped; v++) {
      if (h1[v] > a) continue;
      C->vinv = v / 3, C->vaxis = v % 3, C->a = a;
      if (p1dfs(C, &ys[v], &cs[v], 0, a, -1)) break;
    }
    if (!C->trace && C->bestlen >= 0) break;
  }
  return C->bestlen;
}

/* ------------------------------------------------------------ prover with a shared ceiling */

typedef struct {
  _Atomic int ceiling, bound;
  volatile int stop;
} Race;

static void race_found(void *arg, int len) {
  Race *rs = arg;
  int c = atomic_load(&rs->ceiling);
  while (len < c && !atomic_compare_exchange_weak(&rs->ceiling, &c, len)) {
  }
  if (len <= atomic_load(&rs->bound)) rs->stop = 1;
}

typedef struct {
  Result R;
  int cert; /* ended because the ceiling met the proven floor */
  int bound_end;
  double round_s[32];
} PResult;

/* lab/3x3's solve(), with an external stop flag, a shared ceiling and k threads in split mode. */
static void solve_race(const Floor *F, const Cube *x, uint64_t maxnodes, PResult *P, int split, int nthr, Race *rs) {
  Result *R = &P->R;
  Search S;
  memset(&S, 0, sizeof S);
  memset(P, 0, sizeof *P);
  S.F = F;
  S.maxnodes = maxnodes;
  S.stop = &rs->stop;
  double t0 = now();
  R->nstab = root_symmetry(&S, x);
  int hv[96] = {0};
  floor_values(F, x, hv);
  Coords cx;
  coords_of(x, &cx);
  int h = 0;
  for (int l = 0; l < F->nl; l++)
    if (hv[l] > h) h = hv[l];
  R->h0 = h;
  R->length = -1;
  for (int bound = h; bound <= 26; bound++) {
    atomic_store(&rs->bound, bound);
    P->bound_end = bound;
    if (atomic_load(&rs->ceiling) <= bound) {
      P->cert = 1;
      break;
    }
    double tb = now();
    uint64_t before = S.nodes;
    int found;
    if (split && bound > split + 1) {
      int cap = 1024, nt = 0, path[8] = {0};
      Task *tasks = malloc(sizeof(Task) * (size_t)cap);
      collect(&S, x, &cx, 0, split, bound, -1, hv, path, &tasks, &nt, &cap);
      uint64_t sub = 0, budget = maxnodes > S.nodes ? maxnodes - S.nodes : 0;
      int winner = -1, aborted = 0, wpath[32];
#pragma omp parallel for schedule(dynamic, 1) reduction(+ : sub) reduction(| : aborted) num_threads(nthr)
      for (int t = 0; t < nt; t++) {
        if (rs->stop) continue;
        Search T = S;
        T.nodes = 0, T.stop = &rs->stop, T.maxnodes = budget;
        memcpy(T.path, tasks[t].path, sizeof tasks[t].path);
        int ok = dfs(&T, &tasks[t].c, &tasks[t].co, split, bound - split, tasks[t].lastf, tasks[t].hv);
        sub += T.nodes;
        aborted |= T.aborted;
        if (ok) {
#pragma omp critical
          if (winner < 0) {
            winner = t;
            memcpy(wpath, T.path, sizeof wpath);
            rs->stop = 1;
          }
        }
      }
      free(tasks);
      S.nodes += sub;
      found = winner >= 0;
      if (found) memcpy(S.path, wpath, sizeof wpath);
      if (!found && (aborted || S.nodes > maxnodes)) S.aborted = 1;
    } else {
      found = dfs(&S, x, &cx, 0, bound, -1, hv);
    }
    R->per_bound[bound] = S.nodes - before;
    P->round_s[bound] = now() - tb;
    if (found) {
      R->length = bound;
      memcpy(R->path, S.path, sizeof S.path);
      rs->stop = 1;
      break;
    }
    if (rs->stop) { /* the ceiling met this round's bound */
      P->cert = 1;
      break;
    }
    if (S.aborted) break;
  }
  R->nodes = S.nodes;
  R->aborted = S.aborted && !P->cert;
  R->secs = now() - t0;
}

typedef struct {
  Ceil C;
  Race *rs;
  const Cube *x;
  double cap;
} CeilThread;

static void *ceil_thread(void *arg) {
  CeilThread *ct = arg;
  ct->C.stop = &ct->rs->stop;
  ct->C.on_found = race_found;
  ct->C.arg = ct->rs;
  ceiling_run(&ct->C, ct->x, 22, ct->cap, 1, 1);
  return NULL;
}

/* ------------------------------------------------------------ commands */

static int read_lines(const char *path, char **lines, int max) {
  FILE *f = fopen(path, "r");
  if (!f) die("cannot open input file");
  char line[1024];
  int n = 0;
  while (fgets(line, sizeof line, f) && n < max) {
    line[strcspn(line, "\r\n")] = 0;
    if (!line[0] || line[0] == '#') continue;
    lines[n++] = strdup(line);
  }
  fclose(f);
  return n;
}

/* "D scramble" (D = 0 when unknown) */
static void parse_dline(const char *s, int *D, Cube *c) {
  int mv[64];
  char *rest;
  *D = (int)strtol(s, &rest, 10);
  int k = parse_moves(rest, mv);
  if (k < 0) die("bad scramble");
  *c = SOLVED;
  apply(c, mv, k);
}

static void print_trace(const Ceil *C) {
  printf("[");
  for (int i = 0; i < C->nlog; i++)
    printf("%s[%.4f, %d, %llu]", i ? ", " : "", C->log_t[i], C->log_len[i], (unsigned long long)C->log_nodes[i]);
  printf("]");
}

static void sol_str(const int *mv, int n, char *out) {
  out[0] = 0;
  for (int j = 0; j < n; j++) {
    strcat(out, MOVENAME[mv[j]]);
    if (j + 1 < n) strcat(out, " ");
  }
}

static int cmd_ceil(int argc, char **argv) {
  if (argc < 1) die("usage: race ceil selftest|duel|run ...");
  ceil_init();
  if (!strcmp(argv[0], "selftest")) {
    int mx1 = 0, mx2 = 0;
    for (size_t i = 0; i < (size_t)40320 * NSP; i++) {
      if (PrunCS[i] > mx1) mx1 = PrunCS[i];
      if (PrunUS[i] > mx2) mx2 = PrunUS[i];
    }
    printf("phase-2 tables: cp x sp max %d, udp x sp max %d\n", mx1, mx2);
    int n = argc > 1 ? atoi(argv[1]) : 20;
    for (int i = 0; i < n; i++) {
      Cube c;
      random_cube(&c);
      Ceil C;
      memset(&C, 0, sizeof C);
      ceiling_run(&C, &c, 22, 1.0, 1, i & 1);
      printf("random %d (fullfloor %d): floor %d, trace ", i, i & 1, C.floor0);
      print_trace(&C);
      printf("\n");
      if (C.bestlen < 0) die("no solution within 22 in 1 s");
    }
    printf("all solutions replayed to solved\n");
    return 0;
  }
  if (!strcmp(argv[0], "duel")) {
    /* duel <file> <capD> <capTrace> [fullfloor=1] */
    if (argc < 4) die("usage: race ceil duel <file> <capD> <capTrace> [fullfloor]");
    char *lines[1024];
    int n = read_lines(argv[1], lines, 1024);
    double capD = atof(argv[2]), capT = atof(argv[3]);
    int ff = argc > 4 ? atoi(argv[4]) : 1;
#pragma omp parallel for schedule(dynamic, 1)
    for (int i = 0; i < n; i++) {
      int D;
      Cube c;
      parse_dline(lines[i], &D, &c);
      Ceil A, B;
      memset(&A, 0, sizeof A);
      memset(&B, 0, sizeof B);
      int la = -1;
      if (D > 0 && capD > 0) la = ceiling_run(&A, &c, D, capD, 0, ff);
      double ta = now() - A.t0;
      B.stop_at = D;
      if (capT > 0) ceiling_run(&B, &c, 22, capT, 1, ff);
      int bad = (D > 0 && la >= 0 && la < D) || (D > 0 && B.bestlen >= 0 && B.bestlen < D);
#pragma omp critical
      {
        printf("{\"index\": %d, \"D\": %d, \"floor0\": %d, \"fullfloor\": %d, ", i, D, B.floor0 ? B.floor0 : A.floor0, ff);
        printf("\"target\": {\"found\": %s, \"length\": %d, \"secs\": %.4f, \"nodes\": %llu, \"cap\": %.1f}, ",
               la >= 0 ? "true" : "false", la, capD > 0 && D > 0 ? ta : -1.0, (unsigned long long)A.nodes, capD);
        printf("\"trace\": ");
        print_trace(&B);
        printf(", \"trace_nodes\": %llu, \"trace_cap\": %.1f, \"shorter_than_D\": %s}\n", (unsigned long long)B.nodes,
               capT, bad ? "true" : "false");
        fflush(stdout);
        fprintf(stderr, "  #%d D=%d target %s %.2fs, trace best %d\n", i, D, la >= 0 ? "hit" : "miss", ta, B.bestlen);
      }
    }
    return 0;
  }
  if (!strcmp(argv[0], "run")) {
    /* run <file> <1t|split|race> <k> <cap_s> [maxnodes] */
    if (argc < 5) die("usage: race ceil run <file> <1t|split|race> <k> <cap_s> [maxnodes]");
    char *lines[1024];
    int n = read_lines(argv[1], lines, 1024);
    const char *mode = argv[2];
    int k = atoi(argv[3]);
    double cap = atof(argv[4]);
    uint64_t maxnodes = argc > 5 ? strtoull(argv[5], NULL, 10) : 30000000000ull;
    int split = getenv("CUBE3_SPLIT") ? atoi(getenv("CUBE3_SPLIT")) : 3;
    int israce = !strcmp(mode, "race"), issplit = !strcmp(mode, "split");
    if (!israce && !issplit && strcmp(mode, "1t")) die("mode must be 1t, split or race");
    int pthr = israce ? k - 1 : issplit ? k : 1;
    for (int i = 0; i < n; i++) {
      int D;
      Cube c;
      parse_dline(lines[i], &D, &c);
      Race rs;
      atomic_store(&rs.ceiling, 99);
      atomic_store(&rs.bound, 0);
      rs.stop = 0;
      CeilThread ct;
      memset(&ct, 0, sizeof ct);
      ct.rs = &rs, ct.x = &c, ct.cap = cap;
      pthread_t th;
      double t0 = now();
      if (israce) pthread_create(&th, NULL, ceil_thread, &ct);
      PResult P;
      solve_race(&DESK, &c, maxnodes, &P, pthr > 1 ? split : 0, pthr, &rs);
      rs.stop = 1;
      if (israce) pthread_join(th, NULL);
      double secs = now() - t0;
      int len = -1, *path = NULL;
      if (P.R.length >= 0) len = P.R.length, path = P.R.path;
      else if (P.cert) len = ct.C.bestlen, path = ct.C.best;
      int ok = len >= 0;
      if (ok) {
        Cube z = c;
        apply(&z, path, len);
        ok = same(&z, &SOLVED);
      }
      if (P.cert && len != P.bound_end) die("ceiling certificate with length != proven floor");
      if (D > 0 && len >= 0 && len != D) die("length differs from the known optimum");
      char sol[256];
      sol_str(path ? path : (int[]){0}, len > 0 ? len : 0, sol);
      printf("{\"index\": %d, \"D\": %d, \"mode\": \"%s\", \"k\": %d, \"length\": %d, \"solution\": \"%s\", \"verified\": %s, ",
             i, D, mode, k, len, sol, ok ? "true" : "false");
      printf("\"by_ceiling\": %s, \"dnf\": %s, \"secs\": %.4f, \"prover_secs\": %.4f, \"nodes\": %llu, \"h0\": %d, ",
             P.cert ? "true" : "false", len < 0 ? "true" : "false", secs, P.R.secs, (unsigned long long)P.R.nodes, P.R.h0);
      printf("\"round_secs\": {");
      int first = 1;
      for (int b = 0; b < 32; b++)
        if (P.round_s[b] > 0)
          printf("%s\"%d\": %.4f", first ? "" : ", ", b, P.round_s[b]), first = 0;
      printf("}, \"nodes_per_bound\": {");
      first = 1;
      for (int b = 0; b < 32; b++)
        if (P.R.per_bound[b])
          printf("%s\"%d\": %llu", first ? "" : ", ", b, (unsigned long long)P.R.per_bound[b]), first = 0;
      printf("}, \"ceiling_nodes\": %llu, \"ceiling_trace\": ", (unsigned long long)ct.C.nodes);
      print_trace(&ct.C);
      printf("}\n");
      fflush(stdout);
      fprintf(stderr, "  #%d %s k=%d len %d %.3fs%s\n", i, mode, k, len, secs, P.cert ? " (ceiling)" : "");
    }
    return 0;
  }
  die("unknown ceil subcommand");
  return 1;
}
