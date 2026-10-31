/*
 * T7 combined native solver (speed lab, issue #35). Included at the end of comb.c, a copy of
 * lab/3x3/src/cube3.c, after T3's gravity.inc (downhill masks, gdfs) and T6's ceiling.inc (two-phase
 * ceiling, shared ceiling, certificate).
 *
 *   comb run <file> <split|race> <k> <masks 0|1> <help 0|1> <cap_s>
 *
 * Proof rounds above depth split + 1 are split into the subtrees at depth `split` (CUBE3_SPLIT,
 * default 3), as lab/3x3's collect() builds them. Instead of OpenMP's fixed team, a pthread pool
 * takes them from a shared list with an atomic next-task counter, so any thread that is free, the
 * ceiling thread included, can join a round that is already running.
 *
 *   split k: k prover threads (the main thread and k - 1 pool threads), no ceiling.
 *   race k:  k - 1 prover threads and one ceiling thread (T6's trace, target 22, lowered after each
 *            solution). With help = 1 the ceiling thread stops searching once the ceiling has not
 *            improved for max(COMB_HELP_MIN s, COMB_HELP_FRAC * elapsed) (defaults 5 and 0.25) and
 *            takes subtrees from the prover's current and later rounds instead.
 *   masks 1: the prover's subtrees run gdfs with packed 18-bit down masks (T3's mode 3).
 *
 * The shared ceiling and the stop rule are T6's: at every round start the prover publishes its bound
 * and stops if the ceiling is <= it; a ceiling solution <= the published bound raises the stop flag.
 * A helping thread stops like every prover thread.
 */

typedef struct {
  Task *tasks;
  int nt, gen, bound, split;
  _Atomic int next;
  _Atomic uint64_t nodes, skipped, helper_nodes, helper_tasks;
} Round;

typedef struct {
  pthread_mutex_t mu;
  pthread_cond_t cv_new, cv_done;
  Round *cur;
  int gen, active, quit;
  int masks;
  const Search *S0; /* root state: floor, root moves */
  const GSearch *G0;
  Race *rs;
  int found, wrole, wpath[32];
} Pool;

/* Take subtrees of round R until none are left or the stop flag is up. role 1 = the helping ceiling thread. */
static void work_round(Pool *P, Round *R, int role) {
  uint64_t nodes = 0, skipped = 0, ntask = 0;
  for (;;) {
    if (P->rs->stop) break;
    int t = atomic_fetch_add(&R->next, 1);
    if (t >= R->nt) break;
    const Task *tk = &R->tasks[t];
    int ok;
    int path[32];
    if (P->masks) {
      GSearch T = *P->G0;
      T.S.nodes = 0, T.S.stop = &P->rs->stop, T.S.maxnodes = UINT64_MAX, T.skipped = 0, T.mask_reads = 0;
      memcpy(T.S.path, tk->path, sizeof tk->path);
      uint64_t ti[8];
      int ta[8];
      gtask_start(&T, &tk->co, ti, ta);
      ok = gdfs(&T, &tk->c, &tk->co, R->split, R->bound - R->split, tk->lastf, tk->hv, ti, ta);
      nodes += T.S.nodes, skipped += T.skipped;
      memcpy(path, T.S.path, sizeof path);
    } else {
      Search T = *P->S0;
      T.nodes = 0, T.stop = &P->rs->stop, T.maxnodes = UINT64_MAX;
      memcpy(T.path, tk->path, sizeof tk->path);
      ok = dfs(&T, &tk->c, &tk->co, R->split, R->bound - R->split, tk->lastf, tk->hv);
      nodes += T.nodes;
      memcpy(path, T.path, sizeof path);
    }
    ntask++;
    if (ok) {
      pthread_mutex_lock(&P->mu);
      if (!P->found) {
        P->found = 1, P->wrole = role;
        memcpy(P->wpath, path, sizeof path);
      }
      pthread_mutex_unlock(&P->mu);
      P->rs->stop = 1;
      break;
    }
  }
  atomic_fetch_add(&R->nodes, nodes);
  atomic_fetch_add(&R->skipped, skipped);
  if (role) atomic_fetch_add(&R->helper_nodes, nodes), atomic_fetch_add(&R->helper_tasks, ntask);
}

/* Pool member: join every round once, from the one running now (if any) on. */
static void pool_loop(Pool *P, int role) {
  int last = -1;
  pthread_mutex_lock(&P->mu);
  for (;;) {
    while (!P->quit && !(P->cur && P->cur->gen != last)) pthread_cond_wait(&P->cv_new, &P->mu);
    if (P->quit) break;
    Round *R = P->cur;
    last = R->gen;
    P->active++;
    pthread_mutex_unlock(&P->mu);
    work_round(P, R, role);
    pthread_mutex_lock(&P->mu);
    if (--P->active == 0) pthread_cond_broadcast(&P->cv_done);
  }
  pthread_mutex_unlock(&P->mu);
}

static void *pool_thread(void *arg) {
  pool_loop(arg, 0);
  return NULL;
}

/* The main thread runs a round with the pool and returns when every thread that joined is done. */
static void run_round(Pool *P, Round *R) {
  pthread_mutex_lock(&P->mu);
  R->gen = ++P->gen;
  P->cur = R;
  P->active++;
  pthread_cond_broadcast(&P->cv_new);
  pthread_mutex_unlock(&P->mu);
  work_round(P, R, 0);
  pthread_mutex_lock(&P->mu);
  P->cur = NULL; /* every task is taken (or the stop flag is up): nobody new joins */
  P->active--;
  while (P->active > 0) pthread_cond_wait(&P->cv_done, &P->mu);
  pthread_mutex_unlock(&P->mu);
}

/* ------------------------------------------------------------ the ceiling thread */

static double HELP_MIN = 5.0, HELP_FRAC = 0.25;

static int stuck(const Ceil *C) {
  double el = now() - C->t0, last = C->nlog ? C->log_t[C->nlog - 1] : 0.0;
  double thr = HELP_FRAC * el > HELP_MIN ? HELP_FRAC * el : HELP_MIN;
  return el - last >= thr;
}

typedef struct {
  Ceil C;
  Pool *P;
  const Cube *x;
  double cap, helped_at; /* helped_at: seconds into the solve when it started helping, -1 never */
  int help;
} CombCeil;

static void *comb_ceil_thread(void *arg) {
  CombCeil *ct = arg;
  Race *rs = ct->P->rs;
  ct->C.stop = &rs->stop;
  ct->C.on_found = race_found;
  ct->C.arg = rs;
  ct->C.yield = ct->help ? stuck : NULL;
  ct->helped_at = -1;
  ceiling_run(&ct->C, ct->x, 22, ct->cap, 1, 1);
  if (ct->help && !rs->stop) {
    ct->helped_at = now() - ct->C.t0;
    pool_loop(ct->P, 1);
  }
  return NULL;
}

typedef struct {
  Race *rs;
  double deadline;
  volatile int done, timedout;
} Watchdog;

static void *watchdog_thread(void *arg) {
  Watchdog *w = arg;
  while (!w->done) {
    if (now() > w->deadline) {
      w->timedout = 1;
      w->rs->stop = 1;
      break;
    }
    usleep(20000);
  }
  return NULL;
}

/* ------------------------------------------------------------ one solve */

typedef struct {
  int length, h0, bound_end, cert, found_by; /* found_by: 0 prover, 1 helping ceiling thread */
  int timedout, path[32];
  uint64_t nodes, per_bound[32], skipped_per_bound[32], helper_per_bound[32], helper_tasks[32];
  double round_s[32], secs;
} CombResult;

static void comb_solve(const Floor *F, const Cube *x, Pool *P, int split, CombResult *CR, Watchdog *wd) {
  Race *rs = P->rs;
  Search S;
  memset(&S, 0, sizeof S);
  S.F = F;
  S.maxnodes = UINT64_MAX;
  S.stop = &rs->stop;
  GSearch G;
  memset(&G, 0, sizeof G);
  G.mode = 3;
  for (int l = 0; l < F->nl; l++) {
    G.mk[l] = -1;
    if (masked_lookup(&F->L[l])) {
      G.mm[G.nml] = &MASKS[F->L[l].T - TABLES];
      G.mk[l] = G.nml;
      G.ml[G.nml++] = l;
    }
  }
  double t0 = now();
  root_symmetry(&S, x);
  G.S = S;
  P->S0 = &S, P->G0 = &G;
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
  CR->h0 = h;
  CR->length = -1;
  for (int bound = h; bound <= 26; bound++) {
    atomic_store(&rs->bound, bound);
    CR->bound_end = bound;
    if (atomic_load(&rs->ceiling) <= bound) {
      CR->cert = 1;
      break;
    }
    if (rs->stop) break;
    double tb = now();
    uint64_t before = S.nodes;
    int found = 0;
    if (bound > split + 1) {
      int cap = 1024, nt = 0, path[8] = {0};
      Round R;
      memset(&R, 0, sizeof R);
      R.tasks = malloc(sizeof(Task) * (size_t)cap);
      collect(&S, x, &cx, 0, split, bound, -1, hv, path, &R.tasks, &nt, &cap);
      R.nt = nt, R.bound = bound, R.split = split;
      atomic_store(&R.next, 0);
      run_round(P, &R);
      free(R.tasks);
      S.nodes += R.nodes;
      CR->skipped_per_bound[bound] = R.skipped;
      CR->helper_per_bound[bound] = R.helper_nodes;
      CR->helper_tasks[bound] = R.helper_tasks;
      found = P->found;
      if (found) memcpy(S.path, P->wpath, sizeof S.path), CR->found_by = P->wrole;
    } else if (P->masks) {
      G.S.nodes = 0, G.skipped = 0;
      found = gdfs(&G, x, &cx, 0, bound, -1, hv, midx, mat);
      S.nodes += G.S.nodes;
      CR->skipped_per_bound[bound] = G.skipped;
      if (found) memcpy(S.path, G.S.path, sizeof S.path);
    } else {
      found = dfs(&S, x, &cx, 0, bound, -1, hv);
    }
    CR->per_bound[bound] = S.nodes - before;
    CR->round_s[bound] = now() - tb;
    if (found) {
      CR->length = bound;
      memcpy(CR->path, S.path, sizeof S.path);
      rs->stop = 1;
      break;
    }
    if (rs->stop) {
      if (!wd->timedout) CR->cert = 1; /* the ceiling met this round's bound */
      break;
    }
  }
  CR->timedout = wd->timedout && !CR->cert && CR->length < 0;
  CR->nodes = S.nodes;
  CR->secs = now() - t0;
}

static int cmd_comb(int argc, char **argv) {
  if (argc < 7 || strcmp(argv[0], "run")) die("usage: comb comb run <file> <split|race> <k> <masks 0|1> <help 0|1> <cap_s>");
  ceil_init();
  if (getenv("COMB_HELP_MIN")) HELP_MIN = atof(getenv("COMB_HELP_MIN"));
  if (getenv("COMB_HELP_FRAC")) HELP_FRAC = atof(getenv("COMB_HELP_FRAC"));
  char *lines[1024];
  int n = read_lines(argv[1], lines, 1024);
  const char *mode = argv[2];
  int k = atoi(argv[3]), masks = atoi(argv[4]), help = atoi(argv[5]);
  double cap = atof(argv[6]);
  int split = getenv("CUBE3_SPLIT") ? atoi(getenv("CUBE3_SPLIT")) : 3;
  int israce = !strcmp(mode, "race");
  if (!israce && strcmp(mode, "split")) die("mode must be split or race");
  if (help && !israce) die("help needs race");
  int nprov = israce ? k - 1 : k;
  if (nprov < 1) die("need at least one prover thread");
  size_t mask_bytes = 0;
  double tm = now();
  if (masks)
    for (int l = 0; l < DESK.nl; l++)
      if (masked_lookup(&DESK.L[l])) {
        Table *T = DESK.L[l].T;
        int dup = 0;
        for (int j = 0; j < l; j++) dup |= DESK.L[j].T == T;
        load_masks(T, 3);
        if (!dup) mask_bytes += ((size_t)T->n * 18 + 7) / 8;
      }
  fprintf(stderr, "comb: %s k=%d masks=%d help=%d (min %.1fs, frac %.2f), mask load %.1fs, %zu bytes\n", mode, k, masks,
          help, HELP_MIN, HELP_FRAC, now() - tm, mask_bytes);
  for (int i = 0; i < n; i++) {
    int D;
    Cube c;
    parse_dline(lines[i], &D, &c);
    Race rs;
    atomic_store(&rs.ceiling, 99);
    atomic_store(&rs.bound, 0);
    rs.stop = 0;
    Pool P;
    memset(&P, 0, sizeof P);
    pthread_mutex_init(&P.mu, NULL);
    pthread_cond_init(&P.cv_new, NULL);
    pthread_cond_init(&P.cv_done, NULL);
    P.rs = &rs, P.masks = masks;
    Watchdog wd = {&rs, now() + cap, 0, 0};
    pthread_t wth, cth, pth[64];
    pthread_create(&wth, NULL, watchdog_thread, &wd);
    for (int t = 0; t < nprov - 1; t++) pthread_create(&pth[t], NULL, pool_thread, &P);
    CombCeil ct;
    memset(&ct, 0, sizeof ct);
    ct.P = &P, ct.x = &c, ct.cap = cap, ct.help = help, ct.helped_at = -1;
    double t0 = now();
    if (israce) pthread_create(&cth, NULL, comb_ceil_thread, &ct);
    CombResult CR;
    memset(&CR, 0, sizeof CR);
    comb_solve(&DESK, &c, &P, split, &CR, &wd);
    rs.stop = 1;
    pthread_mutex_lock(&P.mu);
    P.quit = 1;
    pthread_cond_broadcast(&P.cv_new);
    pthread_mutex_unlock(&P.mu);
    if (israce) pthread_join(cth, NULL);
    for (int t = 0; t < nprov - 1; t++) pthread_join(pth[t], NULL);
    double secs = now() - t0;
    wd.done = 1;
    pthread_join(wth, NULL);
    int len = -1, *path = NULL;
    if (CR.length >= 0) len = CR.length, path = CR.path;
    else if (CR.cert) len = ct.C.bestlen, path = ct.C.best;
    int ok = len >= 0;
    if (ok) {
      Cube z = c;
      apply(&z, path, len);
      ok = same(&z, &SOLVED);
      if (!ok) die("solution does not solve the position");
    }
    if (CR.cert && len != CR.bound_end) die("ceiling certificate with length != proven floor");
    if (D > 0 && len >= 0 && len != D) die("length differs from the known optimum");
    const char *ended = len < 0 ? "timeout" : CR.cert ? "certificate" : CR.found_by ? "helper_find" : "prover_find";
    char sol[256];
    sol_str(path ? path : (int[]){0}, len > 0 ? len : 0, sol);
    printf("{\"index\": %d, \"D\": %d, \"mode\": \"%s\", \"k\": %d, \"masks\": %d, \"help\": %d, \"help_min\": %.2f, "
           "\"help_frac\": %.3f, \"length\": %d, \"solution\": \"%s\", \"verified\": %s, \"ended\": \"%s\", ",
           i, D, mode, k, masks, help, HELP_MIN, HELP_FRAC, len, sol, ok ? "true" : "false", ended);
    printf("\"proven_floor\": %d, \"secs\": %.4f, \"nodes\": %llu, \"h0\": %d, \"helped_at\": %.3f, \"mask_bytes\": %zu, ",
           CR.cert ? CR.bound_end : len >= 0 ? len : CR.bound_end - 1, secs, (unsigned long long)CR.nodes, CR.h0,
           ct.helped_at, mask_bytes);
    printf("\"round_secs\": {");
    int first = 1;
    for (int b = 0; b < 32; b++)
      if (CR.round_s[b] > 0) printf("%s\"%d\": %.4f", first ? "" : ", ", b, CR.round_s[b]), first = 0;
    printf("}, \"nodes_per_bound\": {");
    first = 1;
    for (int b = 0; b < 32; b++)
      if (CR.per_bound[b] || CR.skipped_per_bound[b])
        printf("%s\"%d\": [%llu, %llu]", first ? "" : ", ", b, (unsigned long long)CR.per_bound[b],
               (unsigned long long)CR.skipped_per_bound[b]),
            first = 0;
    printf("}, \"helper_nodes_per_bound\": {");
    first = 1;
    for (int b = 0; b < 32; b++)
      if (CR.helper_per_bound[b])
        printf("%s\"%d\": [%llu, %llu]", first ? "" : ", ", b, (unsigned long long)CR.helper_per_bound[b],
               (unsigned long long)CR.helper_tasks[b]),
            first = 0;
    printf("}, \"ceiling_nodes\": %llu, \"ceiling_trace\": ", (unsigned long long)ct.C.nodes);
    print_trace(&ct.C);
    printf("}\n");
    fflush(stdout);
    fprintf(stderr, "  #%d %s k=%d m=%d h=%d len %d %.3fs %s%s\n", i, mode, k, masks, help, len, secs, ended,
            ct.helped_at >= 0 ? " (helped)" : "");
    pthread_mutex_destroy(&P.mu);
    pthread_cond_destroy(&P.cv_new);
    pthread_cond_destroy(&P.cv_done);
  }
  return 0;
}
