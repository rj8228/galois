/* ------------------------------------------------------------ anatomy (T4)
 *
 * An instrumented copy of dfs() above. Same move rules, same lookups, same group-by-group
 * pruning, same counting: a "lookup" is one generated child (one floor evaluation; one move from
 * the end it is a compare with solved instead, counted separately as a "test"). The search reads
 * all of a node's children first, then descends (the 2×2 lab's exp8 counting).
 *
 * Added on top:
 *   - per round: lookups, tests, children cut on arrival split by whether the parent was tight
 *     (g + h(parent) == bound), expansions (nodes whose children were generated)
 *   - child orders for the descent: default (move index), path (a given solution's next move first,
 *     the perfect-compass bound), by the floor, by the mirror floor
 *   - count mode: keep going after the first solution and count every shortest solution
 *
 * Usage: anat3 anat <floor> <scrambles.txt> <maxnodes> <modes> [mirror-floor]
 *   modes: letters, any of  c = compass (path) rerun of the final round
 *                           f = final round again, children ordered by the floor
 *                           m = final round again, children ordered by the mirror floor
 *                           n = final round again in count mode (all shortest solutions)
 *                           g = final round again, measuring what downhill masks would let through
 *   mirror-floor: a 4-bit floor whose inverse lookups give h(x^-1) for the m order when <floor>
 *                 has no inverse lookups of its own (2-bit tables cannot be read on the inverse).
 */

typedef struct {
  uint64_t nodes, tests, cut_tight, cut_loose, gen_tight, gen_loose, expansions, expansions_tight, extra;
} RStat;

enum { ORD_DEFAULT, ORD_PATH, ORD_FLOOR, ORD_MIRROR };

typedef struct {
  const Floor *F, *M; /* M: mirror floor for ORD_MIRROR (its inverse lookups), or NULL */
  int order, count, bound;
  uint64_t maxnodes;
  int aborted;
  int path[32];
  const int *target;
  uint64_t nsol, nsol_raw, first_nodes;
  int firstpath[32];
  RStat st;
  uint8_t root_moves[18];
  int nroot;
  /* gravity mode: at tight nodes, which children would downhill masks on the direct lookups let
   * through? full rule: lookups at the parent's max must go down, at max - 1 must not go up;
   * down-only rule: only the first part (one 18-bit mask per entry instead of two). */
  int gravity;
  uint64_t g_gen, g_allowed, g_allowed_down, g_survived, g_mask_reads, g_mask_reads_down, g_expansions;
} ASearch;

static inline int a_next_lastf(const ASearch *A, int g, int f) { return g == 0 && A->nroot < 18 ? f + 6 : f; }

static int a_found(ASearch *A) {
  /* Each adjacent pair of opposite faces (U D, R L, F B) also stands for its swapped order. */
  int pairs = 0;
  for (int j = 0; j + 1 < A->bound; j++) pairs += A->path[j] / 3 + 3 == A->path[j + 1] / 3;
  A->nsol_raw += 1ull << pairs;
  if (A->nsol++ == 0) {
    A->first_nodes = A->st.nodes;
    memcpy(A->firstpath, A->path, sizeof A->path);
  }
  return !A->count;
}

static int adfs(ASearch *A, const Cube *x, const Coords *cx, int g, int rem, int lastf, const int *hv, int onpath) {
  const Floor *F = A->F;
  if (rem == 0) return same(x, &SOLVED) ? a_found(A) : 0; /* only for a solved scramble */
  int hp = 0;
  for (int l = 0; l < F->nl; l++)
    if (hv[l] > hp) hp = hv[l];
  int tight = g + hp == A->bound;
  A->st.expansions++;
  if (tight) A->st.expansions_tight++;
  int nm = g == 0 ? A->nroot : 18;
  int mlist[18], nml = 0;
  for (int mi = 0; mi < nm; mi++) mlist[nml++] = g == 0 ? A->root_moves[mi] : mi;
  if (A->order == ORD_PATH && onpath) { /* the solution's next move first */
    for (int i = 0; i < nml; i++)
      if (mlist[i] == A->target[g]) {
        int t = mlist[i];
        memmove(mlist + 1, mlist, sizeof(int) * (size_t)i);
        mlist[0] = t;
        break;
      }
  }
  if (rem == 1) {
    int any = 0;
    for (int mi = 0; mi < nml; mi++) {
      int m = mlist[mi];
      if (skip_face(m / 3, lastf)) continue;
      Cube y;
      mul(x, &MV[m], &y);
      A->st.nodes++, A->st.tests++;
      if (tight) A->st.gen_tight++;
      else A->st.gen_loose++;
      if (same(&y, &SOLVED)) {
        A->path[g] = m;
        any = 1;
        if (a_found(A)) return 1;
      } else if (tight) A->st.cut_tight++;
      else A->st.cut_loose++;
    }
    return any && !A->count;
  }
  Cube ys[18];
  Coords cs[18];
  NodeCache ncs[18];
  int ms[18], nc = 0, hv2[18][96];
  for (int mi = 0; mi < nml; mi++) {
    int m = mlist[mi];
    if (skip_face(m / 3, lastf)) continue;
    mul(x, &MV[m], &ys[nc]);
    coords_move(cx, m, &cs[nc], F->axmask);
    ncs[nc].x = &ys[nc], ncs[nc].have_inv = 0, ncs[nc].have_pos[0] = ncs[nc].have_pos[1] = 0, ncs[nc].ncj = 0;
    ms[nc++] = m;
  }
  A->st.nodes += (uint64_t)nc;
  if (tight) A->st.gen_tight += (uint64_t)nc;
  else A->st.gen_loose += (uint64_t)nc;
  int alive[18], na = nc;
  for (int i = 0; i < nc; i++) alive[i] = i;
  for (int gi = 0; gi < F->ng && na; gi++) {
    int lo = F->gs[gi], hi = F->gs[gi + 1], w = 0;
    uint64_t gidx[18][48];
    for (int a = 0; a < na; a++) {
      int i = alive[a];
      for (int l = lo; l < hi; l++) {
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
  if (A->gravity && tight) {
    A->g_expansions++;
    A->g_gen += (uint64_t)nc;
    A->g_survived += (uint64_t)na;
    for (int l = 0; l < F->n1; l++) {
      if (hv[l] == hp) A->g_mask_reads++, A->g_mask_reads_down++;
      else if (hv[l] == hp - 1) A->g_mask_reads++;
    }
    for (int i = 0; i < nc; i++) {
      int ok = 1, okd = 1;
      for (int l = 0; l < F->n1; l++) {
        if (hv[l] < hp - 1) continue;
        int v = entry_value(&F->L[l], lookup_index_c(&F->L[l], &ncs[i], &cs[i]), hv[l]);
        if (hv[l] == hp && v >= hv[l]) ok = okd = 0;
        if (hv[l] == hp - 1 && v > hv[l]) ok = 0;
      }
      A->g_allowed += (uint64_t)ok;
      A->g_allowed_down += (uint64_t)okd;
    }
  }
  uint64_t cut = (uint64_t)(nc - na);
  if (tight) A->st.cut_tight += cut;
  else A->st.cut_loose += cut;
  if (A->order == ORD_FLOOR || A->order == ORD_MIRROR) {
    int key[18];
    for (int a = 0; a < na; a++) {
      int i = alive[a], h = 0, hi = 0;
      for (int l = 0; l < F->nl; l++)
        if (hv2[i][l] > h) h = hv2[i][l];
      if (A->order == ORD_FLOOR) {
        key[a] = h;
        continue;
      }
      if (A->M) {
        const Floor *M = A->M;
        for (int l = M->n1; l < M->nl; l++) {
          int v = get4(M->L[l].T, lookup_index(&M->L[l], &ncs[i]));
          if (v > hi) hi = v;
        }
        A->st.extra += (uint64_t)(M->nl - M->n1);
      } else {
        for (int l = F->n1; l < F->nl; l++)
          if (hv2[i][l] > hi) hi = hv2[i][l];
      }
      int hm = h > hi ? h : hi;
      key[a] = hm * 64 + h + hi;
    }
    for (int a = 1; a < na; a++) { /* stable insertion sort, ascending key */
      int k = key[a], v = alive[a], b = a - 1;
      while (b >= 0 && key[b] > k) key[b + 1] = key[b], alive[b + 1] = alive[b], b--;
      key[b + 1] = k, alive[b + 1] = v;
    }
  }
  int any = 0;
  for (int a = 0; a < na; a++) {
    int i = alive[a];
    A->path[g] = ms[i];
    int on = onpath && A->target && ms[i] == A->target[g];
    if (adfs(A, &ys[i], &cs[i], g + 1, rem - 1, a_next_lastf(A, g, ms[i] / 3), hv2[i], on)) return 1;
    if (A->nsol) any = 1;
    if (A->st.nodes > A->maxnodes) {
      A->aborted = 1;
      return 0;
    }
  }
  (void)any;
  return 0;
}

static void a_init(ASearch *A, const Floor *F, const Cube *x, uint64_t maxnodes, int *nstab) {
  memset(A, 0, sizeof *A);
  A->F = F;
  A->maxnodes = maxnodes;
  Search S;
  memset(&S, 0, sizeof S);
  *nstab = root_symmetry(&S, x);
  A->nroot = S.nroot;
  memcpy(A->root_moves, S.root_moves, sizeof S.root_moves);
}

/* One round at a fixed bound. */
static void a_round(ASearch *A, const Cube *x, const Coords *cx, const int *hv, int bound) {
  memset(&A->st, 0, sizeof A->st);
  A->bound = bound, A->nsol = 0, A->nsol_raw = 0, A->first_nodes = 0, A->aborted = 0;
  adfs(A, x, cx, 0, bound, -1, hv, 1);
}

static void print_rstat(const RStat *s) {
  printf("{\"lookups\": %llu, \"tests\": %llu, \"cut_tight\": %llu, \"cut_loose\": %llu, \"gen_tight\": %llu, "
         "\"gen_loose\": %llu, \"expansions\": %llu, \"expansions_tight\": %llu, \"extra\": %llu}",
         (unsigned long long)s->nodes, (unsigned long long)s->tests, (unsigned long long)s->cut_tight,
         (unsigned long long)s->cut_loose, (unsigned long long)s->gen_tight, (unsigned long long)s->gen_loose,
         (unsigned long long)s->expansions, (unsigned long long)s->expansions_tight, (unsigned long long)s->extra);
}

static int replay_ok(const Cube *c, const int *p, int n) {
  Cube z = *c;
  apply(&z, p, n);
  return same(&z, &SOLVED);
}

static void path_str(const int *p, int n, char *out) {
  out[0] = 0;
  for (int j = 0; j < n; j++) {
    strcat(out, MOVENAME[p[j]]);
    if (j + 1 < n) strcat(out, " ");
  }
}

static int cmd_anat(int argc, char **argv) {
  if (argc < 4) die("usage: anat3 anat <floor> <scrambles.txt> <maxnodes> <modes> [mirror-floor]");
  static Floor F, M;
  parse_floor(argv[0], &F);
  int have_m = 0;
  if (argc > 4) {
    parse_floor(argv[4], &M);
    if (M.n1 == M.nl) die("mirror floor needs inverse lookups");
    have_m = 1;
  }
  uint64_t maxnodes = strtoull(argv[2], NULL, 10);
  const char *modes = argv[3];
  FILE *f = fopen(argv[1], "r");
  if (!f) die("cannot open scramble file");
  char line[1024], *lines[1024];
  int n = 0;
  while (fgets(line, sizeof line, f) && n < 1024) {
    line[strcspn(line, "\r\n")] = 0;
    if (!line[0] || line[0] == '#') continue;
    lines[n++] = strdup(line);
  }
  fclose(f);
  size_t aux, bytes = floor_bytes(&F, &aux);
  printf("{\"type\": \"meta\", \"floor\": \"%s\", \"lookups_per_node\": %d, \"bytes\": %zu, \"aux_bytes\": %zu, "
         "\"maxnodes\": %llu, \"modes\": \"%s\", \"mirror_floor\": \"%s\", \"threads\": %d}\n",
         F.name, F.nl, bytes, aux, (unsigned long long)maxnodes, modes, have_m ? M.name : "", omp_get_max_threads());
  fflush(stdout);
#pragma omp parallel for schedule(dynamic, 1)
  for (int i = 0; i < n; i++) {
    int mv[64], k = parse_moves(lines[i], mv);
    if (k < 0) die("bad scramble");
    Cube c = SOLVED;
    apply(&c, mv, k);
    double t0 = now();
    int hv[96] = {0}, nstab, h0 = 0;
    floor_values(&F, &c, hv);
    for (int l = 0; l < F.nl; l++)
      if (hv[l] > h0) h0 = hv[l];
    Coords cx;
    coords_of(&c, &cx);
    ASearch A;
    a_init(&A, &F, &c, maxnodes, &nstab);
    RStat rounds[32];
    int nr = 0, length = -1, sol[32];
    uint64_t total = 0;
    int aborted = 0;
    for (int b = h0; b <= 26; b++) {
      A.maxnodes = maxnodes > total ? maxnodes - total : 0;
      a_round(&A, &c, &cx, hv, b);
      rounds[nr++] = A.st;
      total += A.st.nodes;
      if (A.nsol) {
        length = b;
        memcpy(sol, A.firstpath, sizeof sol);
        break;
      }
      if (A.aborted) {
        aborted = 1;
        break;
      }
    }
    double secs = now() - t0;
    int verified = length >= 0 && replay_ok(&c, sol, length);
    /* extra final-round runs */
    RStat ext[5];
    int ext_ok[5] = {0}, ext_ab[5] = {0}, ext_len[5] = {-1, -1, -1, -1, -1};
    double ext_s[5] = {0};
    uint64_t nsol = 0, nsol_raw = 0, first = 0;
    const char *codes = "cfmng";
    uint64_t gv[7] = {0};
    for (int e = 0; e < 5; e++) {
      if (length < 0 || !strchr(modes, codes[e])) continue;
      double te = now();
      a_init(&A, &F, &c, maxnodes, &nstab);
      A.order = e == 0 ? ORD_PATH : e == 1 ? ORD_FLOOR : e == 2 ? ORD_MIRROR : ORD_DEFAULT;
      A.target = sol;
      A.M = e == 2 && have_m ? &M : NULL;
      A.count = e == 3;
      A.gravity = e == 4;
      a_round(&A, &c, &cx, hv, length);
      if (e == 4) {
        uint64_t t[7] = {A.g_gen, A.g_allowed, A.g_allowed_down, A.g_survived, A.g_mask_reads, A.g_mask_reads_down,
                         A.g_expansions};
        memcpy(gv, t, sizeof t);
      }
      ext[e] = A.st;
      ext_ab[e] = A.aborted;
      ext_len[e] = A.nsol ? length : -1;
      ext_ok[e] = A.nsol && replay_ok(&c, A.firstpath, length);
      ext_s[e] = now() - te;
      if (e == 3) nsol = A.nsol, nsol_raw = A.nsol_raw, first = A.first_nodes;
    }
    char s1[256];
    path_str(sol, length, s1);
#pragma omp critical
    {
      printf("{\"type\": \"solve\", \"index\": %d, \"scramble\": \"%s\", \"length\": %d, \"solution\": \"%s\", "
             "\"verified\": %s, \"capped\": %s, \"h0\": %d, \"root_symmetries\": %d, \"lookups\": %llu, \"seconds\": %.4f, "
             "\"rounds\": [",
             i, lines[i], length, s1, verified ? "true" : "false", aborted ? "true" : "false", h0, nstab,
             (unsigned long long)total, secs);
      for (int r = 0; r < nr; r++) {
        if (r) printf(", ");
        print_rstat(&rounds[r]);
      }
      printf("]");
      const char *names[5] = {"compass", "by_floor", "by_mirror", "count", "gravity"};
      for (int e = 0; e < 5; e++) {
        if (length < 0 || !strchr(modes, codes[e])) continue;
        printf(", \"%s\": {\"final\": ", names[e]);
        print_rstat(&ext[e]);
        printf(", \"found_length\": %d, \"verified\": %s, \"capped\": %s, \"seconds\": %.4f", ext_len[e],
               ext_ok[e] ? "true" : "false", ext_ab[e] ? "true" : "false", ext_s[e]);
        if (e == 3) printf(", \"solutions\": %llu, \"solutions_raw\": %llu, \"first_at\": %llu", (unsigned long long)nsol,
                             (unsigned long long)nsol_raw, (unsigned long long)first);
        if (e == 4)
          printf(", \"tight_generated\": %llu, \"allowed\": %llu, \"allowed_down_only\": %llu, \"survived\": %llu, "
                 "\"mask_reads\": %llu, \"mask_reads_down_only\": %llu, \"tight_expansions\": %llu",
                 (unsigned long long)gv[0], (unsigned long long)gv[1], (unsigned long long)gv[2], (unsigned long long)gv[3],
                 (unsigned long long)gv[4], (unsigned long long)gv[5], (unsigned long long)gv[6]);
        printf("}");
      }
      printf("}\n");
      fflush(stdout);
      fprintf(stderr, "  #%d len %d lookups %llu %.2fs%s\n", i, length, (unsigned long long)total, secs,
              aborted ? " CAPPED" : "");
    }
  }
  return 0;
}
