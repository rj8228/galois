/*
 * cube3: floors (lower bounds) for guaranteed-optimal 3x3 solving.
 *
 *   cube3 build <table>|all          breadth-first search, writes tables/<name>.{4,2}.bin
 *   cube3 selftest                   symmetry, coordinate and fast-path checks
 *   cube3 verify [--ida=N] <floor>.. every floor against the true distance, all positions <= 6 moves;
 *                                    the first N floors also solve them with IDA*
 *   cube3 stats <floor> ...          mean floor over random states, lookup speed
 *   cube3 solve <floor> <file> [max] IDA* on every scramble in <file>, one JSON line per solve,
 *                                    each solve stopped after max nodes
 *
 * Environment: CUBE3_TABLES (table directory, default tables), CUBE3_SPLIT=d (one solve at a time on
 * all threads, sharing the subtrees at depth d), CUBE3_VERBOSE (nodes per depth bound on stderr),
 * OMP_NUM_THREADS.
 *
 * Cube model, move and symmetry definitions follow Kociemba's cubie conventions (the same
 * corner labels as src/solver/cube2.ts). A floor is a '+'-joined list of tokens, see parse_floor.
 */
#define _GNU_SOURCE
#include <fcntl.h>
#include <omp.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>

enum { URF, UFL, ULB, UBR, DFR, DLF, DBL, DRB };
enum { UR, UF, UL, UB, DR, DF, DL, DB, FR, FL, BL, BR };

typedef struct {
  uint8_t cp[8], co[8], ep[12], eo[12];
} Cube;

static double now(void) {
  struct timespec t;
  clock_gettime(CLOCK_MONOTONIC, &t);
  return t.tv_sec + t.tv_nsec * 1e-9;
}

static void die(const char *msg) {
  fprintf(stderr, "cube3: %s\n", msg);
  exit(1);
}

static const char *TABLE_DIR = "tables";

/* ------------------------------------------------------------------ cube */

static const Cube SOLVED = {{0, 1, 2, 3, 4, 5, 6, 7}, {0}, {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11}, {0}};

static const Cube BASE[6] = {
    /* U */ {{UBR, URF, UFL, ULB, DFR, DLF, DBL, DRB}, {0}, {UB, UR, UF, UL, DR, DF, DL, DB, FR, FL, BL, BR}, {0}},
    /* R */
    {{DFR, UFL, ULB, URF, DRB, DLF, DBL, UBR}, {2, 0, 0, 1, 1, 0, 0, 2}, {FR, UF, UL, UB, BR, DF, DL, DB, DR, FL, BL, UR}, {0}},
    /* F */
    {{UFL, DLF, ULB, UBR, URF, DFR, DBL, DRB},
     {1, 2, 0, 0, 2, 1, 0, 0},
     {UR, FL, UL, UB, DR, FR, DL, DB, UF, DF, BL, BR},
     {0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0}},
    /* D */ {{URF, UFL, ULB, UBR, DLF, DBL, DRB, DFR}, {0}, {UR, UF, UL, UB, DF, DL, DB, DR, FR, FL, BL, BR}, {0}},
    /* L */
    {{URF, ULB, DBL, UBR, DFR, UFL, DLF, DRB}, {0, 1, 2, 0, 0, 2, 1, 0}, {UR, UF, BL, UB, DR, DF, FL, DB, FR, UL, DL, BR}, {0}},
    /* B */
    {{URF, UFL, UBR, DRB, DFR, DLF, ULB, DBL},
     {0, 0, 1, 2, 0, 0, 2, 1},
     {UR, UF, UL, BR, DR, DF, DL, BL, FR, FL, UB, DB},
     {0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1}},
};

/* Symmetry generators. Corner orientations 3..5 mark a mirrored cube (LR2). */
static const Cube S_URF3 = {{URF, DFR, DLF, UFL, UBR, DRB, DBL, ULB},
                            {1, 2, 1, 2, 2, 1, 2, 1},
                            {UF, FR, DF, FL, UB, BR, DB, BL, UR, DR, DL, UL},
                            {1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1}};
static const Cube S_F2 = {{DLF, DFR, DRB, DBL, UFL, URF, UBR, ULB}, {0}, {DL, DF, DR, DB, UL, UF, UR, UB, FL, FR, BR, BL}, {0}};
static const Cube S_U4 = {{UBR, URF, UFL, ULB, DRB, DFR, DLF, DBL},
                          {0},
                          {UB, UR, UF, UL, DB, DR, DF, DL, BR, FR, FL, BL},
                          {0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1}};
static const Cube S_LR2 = {
    {UFL, URF, UBR, ULB, DLF, DFR, DRB, DBL}, {3, 3, 3, 3, 3, 3, 3, 3}, {UL, UF, UR, UB, DL, DF, DR, DB, FL, FR, BR, BL}, {0}};

static Cube MV[18], SYM[48];
static int SYMINV[48], SYMMOVE[48][18];
static int AXMOVE[3][18]; /* SYMMOVE for symmetries 0, 16, 32: the three axes */
static const char *MOVENAME[18] = {"U", "U2", "U'", "R", "R2", "R'", "F", "F2", "F'",
                                   "D", "D2", "D'", "L", "L2", "L'", "B", "B2", "B'"};

/* r = a then b (Kociemba's multiply), with mirrored corner orientations. */
static void mul_full(const Cube *a, const Cube *b, Cube *r) {
  for (int i = 0; i < 8; i++) {
    int oa = a->co[b->cp[i]], ob = b->co[i], o;
    r->cp[i] = a->cp[b->cp[i]];
    if (oa < 3 && ob < 3) {
      o = (oa + ob) % 3;
    } else if (oa < 3) {
      o = oa + ob;
      if (o >= 6) o -= 3;
    } else if (ob < 3) {
      o = oa - ob;
      if (o < 3) o += 3;
    } else {
      o = oa - ob;
      if (o < 0) o += 3;
    }
    r->co[i] = (uint8_t)o;
  }
  for (int i = 0; i < 12; i++) {
    r->ep[i] = a->ep[b->ep[i]];
    r->eo[i] = (a->eo[b->ep[i]] + b->eo[i]) & 1;
  }
}

/* r = a then b, both regular (no mirror). The search's inner loop. */
static inline void mul(const Cube *a, const Cube *b, Cube *r) {
  for (int i = 0; i < 8; i++) {
    int o = a->co[b->cp[i]] + b->co[i];
    r->cp[i] = a->cp[b->cp[i]];
    r->co[i] = (uint8_t)(o >= 3 ? o - 3 : o);
  }
  for (int i = 0; i < 12; i++) {
    r->ep[i] = a->ep[b->ep[i]];
    r->eo[i] = a->eo[b->ep[i]] ^ b->eo[i];
  }
}

static inline void inverse(const Cube *a, Cube *r) {
  for (int i = 0; i < 8; i++) {
    r->cp[a->cp[i]] = (uint8_t)i;
    r->co[a->cp[i]] = (uint8_t)((3 - a->co[i]) % 3);
  }
  for (int i = 0; i < 12; i++) {
    r->ep[a->ep[i]] = (uint8_t)i;
    r->eo[a->ep[i]] = a->eo[i];
  }
}

static inline int same(const Cube *a, const Cube *b) { return memcmp(a, b, sizeof(Cube)) == 0; }

/* sym_conj(x, s) = S x S^-1. Preserves distance; maps face turns to face turns (SYMMOVE). */
static void sym_conj(const Cube *x, int s, Cube *r) {
  Cube t;
  mul_full(&SYM[s], x, &t);
  mul_full(&t, &SYM[SYMINV[s]], r);
}

static void init_cube(void) {
  for (int f = 0; f < 6; f++) {
    MV[f * 3] = BASE[f];
    mul(&MV[f * 3], &BASE[f], &MV[f * 3 + 1]);
    mul(&MV[f * 3 + 1], &BASE[f], &MV[f * 3 + 2]);
    Cube four;
    mul(&MV[f * 3 + 2], &BASE[f], &four);
    if (!same(&four, &SOLVED)) die("a face turn does not have order 4");
  }
  Cube cc = SOLVED, t;
  for (int a = 0; a < 3; a++) {
    for (int b = 0; b < 2; b++) {
      for (int c = 0; c < 4; c++) {
        for (int d = 0; d < 2; d++) {
          SYM[16 * a + 8 * b + 2 * c + d] = cc;
          mul_full(&cc, &S_LR2, &t);
          cc = t;
        }
        mul_full(&cc, &S_U4, &t);
        cc = t;
      }
      mul_full(&cc, &S_F2, &t);
      cc = t;
    }
    mul_full(&cc, &S_URF3, &t);
    cc = t;
  }
  for (int s = 0; s < 48; s++) {
    SYMINV[s] = -1;
    for (int u = 0; u < 48; u++) {
      mul_full(&SYM[s], &SYM[u], &t);
      if (same(&t, &SOLVED)) SYMINV[s] = u;
      if (u != s && same(&SYM[s], &SYM[u])) die("two symmetries coincide");
    }
    if (SYMINV[s] < 0) die("symmetry without inverse");
  }
  for (int s = 0; s < 48; s++) {
    for (int m = 0; m < 18; m++) {
      sym_conj(&MV[m], s, &t);
      SYMMOVE[s][m] = -1;
      for (int k = 0; k < 18; k++)
        if (same(&t, &MV[k])) SYMMOVE[s][m] = k;
      if (SYMMOVE[s][m] < 0) die("a symmetry does not map face turns to face turns");
    }
  }
  for (int a = 0; a < 3; a++)
    for (int m = 0; m < 18; m++) AXMOVE[a][m] = SYMMOVE[a * 16][m];
}

/* ------------------------------------------------------------ coordinates */

static uint32_t BINOM[13][13];

static inline int twist_of(const Cube *c) {
  int t = 0;
  for (int i = 0; i < 7; i++) t = 3 * t + c->co[i];
  return t;
}
static void set_twist(Cube *c, int t) {
  int s = 0;
  for (int i = 6; i >= 0; i--) {
    c->co[i] = (uint8_t)(t % 3);
    s += t % 3;
    t /= 3;
  }
  c->co[7] = (uint8_t)((3 - s % 3) % 3);
}
static inline int flip_of(const Cube *c) {
  int f = 0;
  for (int i = 0; i < 11; i++) f = 2 * f + c->eo[i];
  return f;
}
static void set_flip(Cube *c, int f) {
  int s = 0;
  for (int i = 10; i >= 0; i--) {
    c->eo[i] = (uint8_t)(f & 1);
    s += f & 1;
    f >>= 1;
  }
  c->eo[11] = (uint8_t)(s & 1);
}
/* Positions of the four E-slice edges (FR FL BL BR), as a combination: 0..494, solved = 494. */
static inline int slice_of(const Cube *c) {
  int s = 0, k = 0;
  for (int p = 0; p < 12; p++)
    if (c->ep[p] >= 8) s += BINOM[p][++k];
  return s;
}
static void set_slice(Cube *c, int s) {
  uint8_t isslice[12] = {0};
  for (int k = 4; k >= 1; k--) {
    int p = 11;
    while (BINOM[p][k] > (uint32_t)s) p--;
    isslice[p] = 1;
    s -= BINOM[p][k];
  }
  int a = 0, b = 8;
  for (int p = 0; p < 12; p++) c->ep[p] = (uint8_t)(isslice[p] ? b++ : a++);
}
static inline uint32_t perm_rank(const uint8_t *p, int n) {
  uint32_t r = 0, used = 0;
  for (int i = 0; i < n; i++) {
    r = r * (n - i) + (p[i] - __builtin_popcount(used & ((1u << p[i]) - 1)));
    used |= 1u << p[i];
  }
  return r;
}
static void perm_unrank(uint32_t r, uint8_t *p, int n) {
  int dig[12];
  for (int i = n - 1; i >= 0; i--) {
    dig[i] = (int)(r % (uint32_t)(n - i));
    r /= (uint32_t)(n - i);
  }
  uint32_t used = 0;
  for (int i = 0; i < n; i++) {
    int v = 0, k = dig[i];
    for (;; v++)
      if (!(used & (1u << v)) && k-- == 0) break;
    p[i] = (uint8_t)v;
    used |= 1u << v;
  }
}
static inline int cperm_of(const Cube *c) { return (int)perm_rank(c->cp, 8); }

#define NTWIST 2187
#define NFLIP 2048
#define NSLICE 495
#define NCPERM 40320
#define SLICE_SOLVED 494

static uint16_t TwistMove[NTWIST][18], FlipMove[NFLIP][18], SliceMove[NSLICE][18], CpermMove[NCPERM][18];
static uint16_t TwistConj[NTWIST][16];

static void init_coords(void) {
  for (int n = 0; n <= 12; n++) {
    BINOM[n][0] = 1;
    for (int k = 1; k <= 12; k++) BINOM[n][k] = n == 0 ? 0 : BINOM[n - 1][k - 1] + BINOM[n - 1][k];
  }
  Cube c, d;
  for (int t = 0; t < NTWIST; t++) {
    c = SOLVED;
    set_twist(&c, t);
    if (twist_of(&c) != t) die("twist coordinate");
    for (int m = 0; m < 18; m++) {
      mul(&c, &MV[m], &d);
      TwistMove[t][m] = (uint16_t)twist_of(&d);
    }
    for (int s = 0; s < 16; s++) {
      sym_conj(&c, s, &d);
      TwistConj[t][s] = (uint16_t)twist_of(&d);
    }
  }
  for (int f = 0; f < NFLIP; f++) {
    c = SOLVED;
    set_flip(&c, f);
    for (int m = 0; m < 18; m++) {
      mul(&c, &MV[m], &d);
      FlipMove[f][m] = (uint16_t)flip_of(&d);
    }
  }
  for (int s = 0; s < NSLICE; s++) {
    c = SOLVED;
    set_slice(&c, s);
    if (slice_of(&c) != s) die("slice coordinate");
    for (int m = 0; m < 18; m++) {
      mul(&c, &MV[m], &d);
      SliceMove[s][m] = (uint16_t)slice_of(&d);
    }
  }
  for (int p = 0; p < NCPERM; p++) {
    c = SOLVED;
    perm_unrank((uint32_t)p, c.cp, 8);
    if (cperm_of(&c) != p) die("corner permutation coordinate");
    for (int m = 0; m < 18; m++) {
      mul(&c, &MV[m], &d);
      CpermMove[p][m] = (uint16_t)cperm_of(&d);
    }
  }
}

/* --------------------------------------------- symmetry-reduced coordinates */

/* Classes of a raw coordinate under the 16 symmetries that keep the U-D axis. */
typedef struct {
  uint32_t nraw, nclass;
  uint16_t *cls;
  uint8_t *sym; /* sym_conj(raw, sym[raw]) == rep[cls[raw]] */
  uint32_t *rep;
  uint16_t *stab; /* symmetries s with sym_conj(rep, s) == rep */
} SymCoord;

static SymCoord CpermSym, FlipSliceSym;
static int cperm_ready, flipslice_ready;

static uint32_t conj_cperm(uint32_t raw, int s) {
  Cube c = SOLVED, d;
  perm_unrank(raw, c.cp, 8);
  sym_conj(&c, s, &d);
  return (uint32_t)cperm_of(&d);
}
static uint32_t conj_flipslice(uint32_t raw, int s) {
  Cube c = SOLVED, d;
  set_slice(&c, (int)(raw / NFLIP));
  set_flip(&c, (int)(raw % NFLIP));
  sym_conj(&c, s, &d);
  return (uint32_t)slice_of(&d) * NFLIP + (uint32_t)flip_of(&d);
}

static void build_symcoord(SymCoord *sc, uint32_t nraw, uint32_t (*cj)(uint32_t, int)) {
  sc->nraw = nraw;
  sc->cls = malloc(nraw * sizeof(uint16_t));
  sc->sym = malloc(nraw);
  uint32_t *conjs = malloc((size_t)nraw * 16 * sizeof(uint32_t));
#pragma omp parallel for schedule(static)
  for (uint32_t r = 0; r < nraw; r++)
    for (int s = 0; s < 16; s++) conjs[(size_t)r * 16 + s] = cj(r, s);
  uint8_t *done = calloc(nraw, 1);
  uint32_t nclass = 0, cap = 1 << 16;
  sc->rep = malloc(cap * sizeof(uint32_t));
  sc->stab = malloc(cap * sizeof(uint16_t));
  for (uint32_t r = 0; r < nraw; r++) {
    if (done[r]) continue;
    if (nclass >= 65535) die("too many symmetry classes for uint16");
    uint16_t st = 0;
    for (int s = 0; s < 16; s++) {
      uint32_t r2 = conjs[(size_t)r * 16 + s];
      if (r2 == r) st |= (uint16_t)(1 << s);
      if (!done[r2]) {
        done[r2] = 1;
        sc->cls[r2] = (uint16_t)nclass;
        sc->sym[r2] = (uint8_t)SYMINV[s];
      }
    }
    sc->rep[nclass] = r;
    sc->stab[nclass] = st;
    nclass++;
  }
  sc->nclass = nclass;
  free(done);
  free(conjs);
}

static void need_cperm_sym(void) {
  if (cperm_ready) return;
  build_symcoord(&CpermSym, NCPERM, conj_cperm);
  cperm_ready = 1;
}
static void need_flipslice_sym(void) {
  if (flipslice_ready) return;
  build_symcoord(&FlipSliceSym, NFLIP * NSLICE, conj_flipslice);
  flipslice_ready = 1;
}

/* ----------------------------------------------------------------- tables */

enum { K_COORD, K_CORNERS, K_CORNERS_SYM, K_PHASE1_SYM, K_EDGES };

typedef struct {
  const char *name;
  int kind;
  int ca, cb;  /* K_COORD: coordinate ids (0 twist, 1 flip, 2 slice), cb = -1 for one */
  int k;       /* K_EDGES: number of edges */
  uint8_t cub[7];
  uint64_t n;
  uint64_t goal;
  const uint8_t *v4, *v2; /* packed 4-bit values / 2-bit values mod 3 */
  double load_s;
} Table;

static const int COORD_N[3] = {NTWIST, NFLIP, NSLICE};

static Table TABLES[] = {
    {"twist", K_COORD, 0, -1, 0, {0}, 0, 0, 0, 0, 0},
    {"flip", K_COORD, 1, -1, 0, {0}, 0, 0, 0, 0, 0},
    {"slice", K_COORD, 2, -1, 0, {0}, 0, 0, 0, 0, 0},
    {"twist_slice", K_COORD, 0, 2, 0, {0}, 0, 0, 0, 0, 0},
    {"flip_slice", K_COORD, 1, 2, 0, {0}, 0, 0, 0, 0, 0},
    {"twist_flip", K_COORD, 0, 1, 0, {0}, 0, 0, 0, 0, 0},
    {"phase1_sym", K_PHASE1_SYM, 0, 0, 0, {0}, 0, 0, 0, 0, 0},
    {"corners", K_CORNERS, 0, 0, 0, {0}, 0, 0, 0, 0, 0},
    {"corners_sym", K_CORNERS_SYM, 0, 0, 0, {0}, 0, 0, 0, 0, 0},
    {"edges6", K_EDGES, 0, 0, 6, {UR, UF, UL, UB, FR, FL}, 0, 0, 0, 0, 0},
    {"edges7", K_EDGES, 0, 0, 7, {UR, UF, UL, UB, FR, FL, BR}, 0, 0, 0, 0, 0},
};
#define NTABLES ((int)(sizeof(TABLES) / sizeof(TABLES[0])))

static uint64_t PERM_N(int k) {
  uint64_t n = 1;
  for (int j = 0; j < k; j++) n *= (uint64_t)(12 - j);
  return n;
}

static inline int coord_val(int id, const Cube *c) {
  return id == 0 ? twist_of(c) : id == 1 ? flip_of(c) : slice_of(c);
}

/* Index of a table entry for a (regular) cube, the slow but obvious path. */
static uint64_t table_index(const Table *T, const Cube *c) {
  switch (T->kind) {
    case K_COORD: {
      uint64_t a = (uint64_t)coord_val(T->ca, c);
      return T->cb < 0 ? a : a * (uint64_t)COORD_N[T->cb] + (uint64_t)coord_val(T->cb, c);
    }
    case K_CORNERS:
      return (uint64_t)cperm_of(c) * NTWIST + (uint64_t)twist_of(c);
    case K_CORNERS_SYM: {
      int r = cperm_of(c);
      return (uint64_t)CpermSym.cls[r] * NTWIST + TwistConj[twist_of(c)][CpermSym.sym[r]];
    }
    case K_PHASE1_SYM: {
      uint32_t r = (uint32_t)slice_of(c) * NFLIP + (uint32_t)flip_of(c);
      return (uint64_t)FlipSliceSym.cls[r] * NTWIST + TwistConj[twist_of(c)][FlipSliceSym.sym[r]];
    }
    default: {
      uint8_t pos[12];
      for (int i = 0; i < 12; i++) pos[c->ep[i]] = (uint8_t)i;
      uint64_t r = 0, o = 0;
      uint32_t used = 0;
      for (int j = 0; j < T->k; j++) {
        int p = pos[T->cub[j]];
        r = r * (uint64_t)(12 - j) + (uint64_t)(p - __builtin_popcount(used & ((1u << p) - 1)));
        used |= 1u << p;
        o |= (uint64_t)c->eo[p] << j;
      }
      return (r << T->k) | o;
    }
  }
}

static void table_init(Table *T) {
  switch (T->kind) {
    case K_COORD:
      T->n = (uint64_t)COORD_N[T->ca] * (T->cb < 0 ? 1 : (uint64_t)COORD_N[T->cb]);
      break;
    case K_CORNERS:
      T->n = (uint64_t)NCPERM * NTWIST;
      break;
    case K_CORNERS_SYM:
      need_cperm_sym();
      T->n = (uint64_t)CpermSym.nclass * NTWIST;
      break;
    case K_PHASE1_SYM:
      need_flipslice_sym();
      T->n = (uint64_t)FlipSliceSym.nclass * NTWIST;
      break;
    default:
      T->n = PERM_N(T->k) << T->k;
  }
  T->goal = table_index(T, &SOLVED);
}

static Table *table_by_name(const char *name) {
  for (int i = 0; i < NTABLES; i++)
    if (!strcmp(TABLES[i].name, name)) return &TABLES[i];
  return NULL;
}

/* Neighbours of an entry in the table's own graph. Symmetry tables also list the entry's twins:
 * other entries that stand for a symmetric copy of the same position. Returns the count. */
static int neighbours(const Table *T, uint64_t idx, uint64_t *out) {
  int n = 0;
  switch (T->kind) {
    case K_COORD: {
      if (T->cb < 0) {
        const uint16_t(*mv)[18] = T->ca == 0 ? TwistMove : T->ca == 1 ? FlipMove : SliceMove;
        for (int m = 0; m < 18; m++) out[n++] = mv[idx][m];
      } else {
        const uint16_t(*ma)[18] = T->ca == 0 ? TwistMove : FlipMove;
        const uint16_t(*mb)[18] = T->cb == 1 ? FlipMove : SliceMove;
        uint64_t nb = (uint64_t)COORD_N[T->cb], a = idx / nb, b = idx % nb;
        for (int m = 0; m < 18; m++) out[n++] = (uint64_t)ma[a][m] * nb + mb[b][m];
      }
      return n;
    }
    case K_CORNERS: {
      uint64_t p = idx / NTWIST, t = idx % NTWIST;
      for (int m = 0; m < 18; m++) out[n++] = (uint64_t)CpermMove[p][m] * NTWIST + TwistMove[t][m];
      return n;
    }
    case K_CORNERS_SYM:
    case K_PHASE1_SYM: {
      const SymCoord *sc = T->kind == K_CORNERS_SYM ? &CpermSym : &FlipSliceSym;
      uint32_t raw = sc->rep[idx / NTWIST];
      int t = (int)(idx % NTWIST);
      for (int m = 0; m < 18; m++) {
        uint32_t r2;
        if (T->kind == K_CORNERS_SYM)
          r2 = CpermMove[raw][m];
        else
          r2 = (uint32_t)SliceMove[raw / NFLIP][m] * NFLIP + FlipMove[raw % NFLIP][m];
        int c2 = sc->cls[r2];
        int t2 = TwistConj[TwistMove[t][m]][sc->sym[r2]];
        uint16_t st = sc->stab[c2];
        out[n++] = (uint64_t)c2 * NTWIST + (uint64_t)t2;
        for (int u = 1; u < 16; u++)
          if (st & (1 << u)) out[n++] = (uint64_t)c2 * NTWIST + TwistConj[t2][u];
      }
      return n;
    }
    default: {
      /* Edge pattern: positions (mixed radix 12, 11, ...) and orientations of the tracked edges. */
      static __thread int dest[18][12], oadd[18][12], ready;
      if (!ready) {
        for (int m = 0; m < 18; m++)
          for (int i = 0; i < 12; i++) {
            dest[m][MV[m].ep[i]] = i;
            oadd[m][MV[m].ep[i]] = MV[m].eo[i];
          }
        ready = 1;
      }
      int k = T->k, pos[7], dig[7];
      uint64_t o = idx & ((1u << k) - 1), r = idx >> k;
      for (int j = k - 1; j >= 0; j--) {
        dig[j] = (int)(r % (uint64_t)(12 - j));
        r /= (uint64_t)(12 - j);
      }
      uint32_t used = 0;
      for (int j = 0; j < k; j++) {
        int v = 0, c = dig[j];
        for (;; v++)
          if (!(used & (1u << v)) && c-- == 0) break;
        pos[j] = v;
        used |= 1u << v;
      }
      for (int m = 0; m < 18; m++) {
        uint64_t rr = 0, oo = 0;
        uint32_t u2 = 0;
        for (int j = 0; j < k; j++) {
          int p = dest[m][pos[j]];
          rr = rr * (uint64_t)(12 - j) + (uint64_t)(p - __builtin_popcount(u2 & ((1u << p) - 1)));
          u2 |= 1u << p;
          oo |= (((o >> j) & 1) ^ (uint64_t)oadd[m][pos[j]]) << j;
        }
        out[n++] = (rr << k) | oo;
      }
      return n;
    }
  }
}

static char *table_path(const Table *T, int bits) {
  static __thread char buf[512];
  snprintf(buf, sizeof buf, "%s/%s.%d.bin", TABLE_DIR, T->name, bits);
  return buf;
}

static void write_file(const char *path, const void *p, size_t n) {
  char tmp[600];
  snprintf(tmp, sizeof tmp, "%s.tmp", path);
  FILE *f = fopen(tmp, "wb");
  if (!f || fwrite(p, 1, n, f) != n || fclose(f)) die("cannot write table file");
  rename(tmp, path);
}

static void build_table(Table *T) {
  table_init(T);
  double t0 = now();
  uint64_t n = T->n, cnt[32] = {0}, filled = 1;
  uint8_t *d = malloc(n);
  if (!d) die("out of memory");
  memset(d, 255, n);
  d[T->goal] = 0;
  cnt[0] = 1;
  int depth = 0;
  fprintf(stderr, "build %s: %llu entries\n", T->name, (unsigned long long)n);
  for (;; depth++) {
    int backward = cnt[depth] * 2 > n - filled;
#pragma omp parallel
    {
      uint64_t out[18 * 16];
      if (!backward) {
#pragma omp for schedule(dynamic, 1 << 16)
        for (uint64_t i = 0; i < n; i++) {
          if (d[i] != depth) continue;
          int k = neighbours(T, i, out);
          for (int j = 0; j < k; j++)
            if (d[out[j]] == 255) d[out[j]] = (uint8_t)(depth + 1);
        }
      } else {
#pragma omp for schedule(dynamic, 1 << 16)
        for (uint64_t i = 0; i < n; i++) {
          if (d[i] != 255) continue;
          int k = neighbours(T, i, out);
          for (int j = 0; j < k; j++)
            if (d[out[j]] == depth) {
              d[i] = (uint8_t)(depth + 1);
              break;
            }
        }
      }
    }
    uint64_t c = 0;
#pragma omp parallel for reduction(+ : c)
    for (uint64_t i = 0; i < n; i++) c += d[i] == depth + 1;
    fprintf(stderr, "  depth %2d: %llu (%s) %.1fs\n", depth + 1, (unsigned long long)c, backward ? "backward" : "forward",
            now() - t0);
    if (!c) break;
    cnt[depth + 1] = c;
    filled += c;
  }
  if (filled != n) die("table not filled: some entries unreachable");
  if (depth > 15) die("depth over 15 does not fit in 4 bits");
  size_t b4 = (size_t)((n + 1) / 2), b2 = (size_t)((n + 3) / 4);
  uint8_t *v4 = calloc(b4, 1), *v2 = calloc(b2, 1);
  for (uint64_t i = 0; i < n; i++) {
    v4[i >> 1] |= (uint8_t)(d[i] << ((i & 1) * 4));
    v2[i >> 2] |= (uint8_t)((d[i] % 3) << ((i & 3) * 2));
  }
  mkdir(TABLE_DIR, 0755);
  write_file(table_path(T, 4), v4, b4);
  write_file(table_path(T, 2), v2, b2);
  double secs = now() - t0, mean = 0;
  for (int i = 0; i <= depth; i++) mean += (double)i * (double)cnt[i];
  mean /= (double)n;
  char jp[512];
  snprintf(jp, sizeof jp, "%s/%s.json", TABLE_DIR, T->name);
  FILE *f = fopen(jp, "w");
  fprintf(f, "{\"table\": \"%s\", \"entries\": %llu, \"bytes_4bit\": %zu, \"bytes_2bit\": %zu, \"max\": %d, ", T->name,
          (unsigned long long)n, b4, b2, depth);
  fprintf(f, "\"mean_over_entries\": %.4f, \"build_seconds\": %.2f, \"threads\": %d, \"counts\": [", mean, secs,
          omp_get_max_threads());
  for (int i = 0; i <= depth; i++) fprintf(f, "%s%llu", i ? ", " : "", (unsigned long long)cnt[i]);
  fprintf(f, "]}\n");
  fclose(f);
  fprintf(stderr, "build %s: done in %.1fs, max %d, mean %.3f\n", T->name, secs, depth, mean);
  free(d);
  free(v4);
  free(v2);
}

static const uint8_t *map_file(const char *path, size_t want) {
  int fd = open(path, O_RDONLY);
  if (fd < 0) {
    fprintf(stderr, "cube3: missing %s (run: ./cube3 build all)\n", path);
    exit(1);
  }
  struct stat st;
  fstat(fd, &st);
  if ((size_t)st.st_size != want) die("table file has the wrong size");
  void *p = mmap(NULL, want, PROT_READ, MAP_SHARED | MAP_POPULATE, fd, 0);
  close(fd);
  if (p == MAP_FAILED) die("mmap failed");
  return p;
}

static void load_table(Table *T, int bits) {
  if (!T->n) table_init(T);
  double t0 = now();
  if (bits == 4 && !T->v4) T->v4 = map_file(table_path(T, 4), (size_t)((T->n + 1) / 2));
  if (bits == 2 && !T->v2) T->v2 = map_file(table_path(T, 2), (size_t)((T->n + 3) / 4));
  T->load_s += now() - t0;
}

static inline int get4(const Table *T, uint64_t i) { return (T->v4[i >> 1] >> ((i & 1) * 4)) & 15; }
static inline int get2(const Table *T, uint64_t i) { return (T->v2[i >> 2] >> ((i & 3) * 2)) & 3; }

/* Bytes the app would hold: the packed table plus any class tables needed to index it. */
static size_t table_bytes(const Table *T, int bits) {
  size_t b = bits == 4 ? (size_t)((T->n + 1) / 2) : (size_t)((T->n + 3) / 4);
  return b;
}
static size_t aux_bytes(const Table *T) {
  if (T->kind == K_CORNERS_SYM) return NCPERM * 3 + sizeof TwistConj;
  if (T->kind == K_PHASE1_SYM) return (size_t)NFLIP * NSLICE * 3 + sizeof TwistConj;
  return 0;
}

/* ---------------------------------------------------------------- lookups */

/* One lookup: a table read on sym_conj(x, sym), or on sym_conj(x^-1, sym). */
typedef struct {
  Table *T;
  int bits, sym, inv;
  int axis; /* >= 0: read from the coordinates the search carries (axis 0, 1, 2 = symmetry 0, 16, 32) */
  int token; /* which floor token it came from; lookups are read in groups (token, direct/inverse) */
  /* Edge tables: tracked cubie c_j = ec[j] of x; it lands at Y-position ypos[q] for x-position q,
   * with orientation eo ^ eco[j] ^ epo[ypos]. */
  uint8_t ec[7], eco[7], ypos[12], epo[12];
} Lookup;

typedef struct {
  char name[128];
  int nl;
  Lookup L[96];
  int needs_inv;
  int axmask; /* axes whose coordinates the search must carry */
  int n1;     /* L[0..n1) are direct lookups, L[n1..nl) inverse ones */
  int ng, gs[65]; /* groups: L[gs[g]..gs[g+1]) share a token and direction; read in this order */
} Floor;

/* Coordinates carried down the search tree: twist, flip and slice seen along each of the three
 * axes (the cube conjugated by symmetry 0, 16 or 32), and the corner permutation. Moving them is
 * three table reads per axis, much cheaper than conjugating the whole cube at every node. */
typedef struct {
  uint16_t tw[3], fl[3], sl[3], cp;
} Coords;

static const int AXIS_SYM[3] = {0, 16, 32};

static void coords_of(const Cube *x, Coords *c) {
  for (int a = 0; a < 3; a++) {
    Cube y;
    sym_conj(x, AXIS_SYM[a], &y);
    c->tw[a] = (uint16_t)twist_of(&y);
    c->fl[a] = (uint16_t)flip_of(&y);
    c->sl[a] = (uint16_t)slice_of(&y);
  }
  c->cp = (uint16_t)cperm_of(x);
}

static inline void coords_move(const Coords *c, int m, Coords *r, int axmask) {
  for (int a = 0; a < 3; a++) {
    if (!(axmask & (1 << a))) continue;
    int mm = AXMOVE[a][m];
    r->tw[a] = TwistMove[c->tw[a]][mm];
    r->fl[a] = FlipMove[c->fl[a]][mm];
    r->sl[a] = SliceMove[c->sl[a]][mm];
  }
  r->cp = CpermMove[c->cp][m];
}

typedef struct {
  const Cube *x;
  Cube inv;
  int have_inv;
  uint8_t pos[2][12];
  int have_pos[2];
  int ncj;
  int cjkey[4];
  Cube cj[4];
} NodeCache;

static inline const Cube *nc_inv(NodeCache *nc) {
  if (!nc->have_inv) {
    inverse(nc->x, &nc->inv);
    nc->have_inv = 1;
  }
  return &nc->inv;
}
static inline const Cube *nc_base(NodeCache *nc, int inv) { return inv ? nc_inv(nc) : nc->x; }
static inline const uint8_t *nc_pos(NodeCache *nc, int inv) {
  if (!nc->have_pos[inv]) {
    const Cube *c = nc_base(nc, inv);
    for (int i = 0; i < 12; i++) nc->pos[inv][c->ep[i]] = (uint8_t)i;
    nc->have_pos[inv] = 1;
  }
  return nc->pos[inv];
}
static inline const Cube *nc_conj(NodeCache *nc, int sym, int inv) {
  const Cube *b = nc_base(nc, inv);
  if (sym == 0) return b;
  int key = sym * 2 + inv;
  for (int i = 0; i < nc->ncj; i++)
    if (nc->cjkey[i] == key) return &nc->cj[i];
  if (nc->ncj == 4) nc->ncj = 0;
  int i = nc->ncj++;
  nc->cjkey[i] = key;
  sym_conj(b, sym, &nc->cj[i]);
  return &nc->cj[i];
}

/* twist, flip and slice of sym_conj(x, s) for a rotation s, without building the conjugate:
 * Y = S x S^-1 puts at slot i the piece x has at slot q = S^-1(i), relabelled and reoriented. */
typedef struct {
  uint8_t cq[8], cco[8], cci[8], eq[12], eeo[12], eei[12], eslice[12];
} ConjMap;
static ConjMap CONJMAP[48];

static void init_conjmap(void) {
  for (int s = 0; s < 48; s++) {
    const Cube *S = &SYM[s], *Si = &SYM[SYMINV[s]];
    ConjMap *M = &CONJMAP[s];
    for (int i = 0; i < 8; i++) M->cq[i] = Si->cp[i], M->cco[i] = S->co[i], M->cci[i] = Si->co[i];
    for (int i = 0; i < 12; i++)
      M->eq[i] = Si->ep[i], M->eeo[i] = S->eo[i], M->eei[i] = Si->eo[i], M->eslice[i] = S->ep[i] >= 8;
  }
}

static inline void conj_coords(const Cube *x, int s, int *tw, int *fl, int *sl) {
  const ConjMap *M = &CONJMAP[s];
  int t = 0, f = 0, c = 0, k = 0;
  for (int i = 0; i < 7; i++) {
    int q = M->cq[i];
    t = 3 * t + (M->cco[x->cp[q]] + x->co[q] + M->cci[i]) % 3;
  }
  for (int i = 0; i < 12; i++) {
    int q = M->eq[i], e = x->ep[q];
    if (i < 11) f = 2 * f + (x->eo[q] ^ M->eeo[e] ^ M->eei[i]);
    if (M->eslice[e]) c += BINOM[i][++k];
  }
  *tw = t, *fl = f, *sl = c;
}

static inline uint64_t lookup_index(const Lookup *L, NodeCache *nc) {
  const Table *T = L->T;
  if (T->kind == K_EDGES) {
    const Cube *c = nc_base(nc, L->inv);
    const uint8_t *pos = nc_pos(nc, L->inv);
    uint64_t r = 0, o = 0;
    uint32_t used = 0;
    for (int j = 0; j < T->k; j++) {
      int q = pos[L->ec[j]], p = L->ypos[q];
      r = r * (uint64_t)(12 - j) + (uint64_t)(p - __builtin_popcount(used & ((1u << p) - 1)));
      used |= 1u << p;
      o |= (uint64_t)(c->eo[q] ^ L->eco[j] ^ L->epo[p]) << j;
    }
    return (r << T->k) | o;
  }
  if (T->kind == K_CORNERS_SYM && L->sym == 0) {
    const Cube *c = nc_base(nc, L->inv);
    int r = cperm_of(c);
    return (uint64_t)CpermSym.cls[r] * NTWIST + TwistConj[twist_of(c)][CpermSym.sym[r]];
  }
  if ((T->kind == K_COORD || T->kind == K_PHASE1_SYM) && SYM[L->sym].co[0] < 3) {
    int v[3];
    conj_coords(nc_base(nc, L->inv), L->sym, &v[0], &v[1], &v[2]);
    if (T->kind == K_PHASE1_SYM) {
      uint32_t r = (uint32_t)v[2] * NFLIP + (uint32_t)v[1];
      return (uint64_t)FlipSliceSym.cls[r] * NTWIST + TwistConj[v[0]][FlipSliceSym.sym[r]];
    }
    return T->cb < 0 ? (uint64_t)v[T->ca] : (uint64_t)v[T->ca] * (uint64_t)COORD_N[T->cb] + (uint64_t)v[T->cb];
  }
  return table_index(T, nc_conj(nc, L->sym, L->inv));
}

static inline uint64_t lookup_index_c(const Lookup *L, NodeCache *nc, const Coords *co) {
  if (L->axis < 0) return lookup_index(L, nc);
  const Table *T = L->T;
  int a = L->axis;
  switch (T->kind) {
    case K_COORD: {
      int v[3] = {co->tw[a], co->fl[a], co->sl[a]};
      return T->cb < 0 ? (uint64_t)v[T->ca] : (uint64_t)v[T->ca] * (uint64_t)COORD_N[T->cb] + (uint64_t)v[T->cb];
    }
    case K_PHASE1_SYM: {
      uint32_t r = (uint32_t)co->sl[a] * NFLIP + co->fl[a];
      return (uint64_t)FlipSliceSym.cls[r] * NTWIST + TwistConj[co->tw[a]][FlipSliceSym.sym[r]];
    }
    case K_CORNERS:
      return (uint64_t)co->cp * NTWIST + co->tw[0];
    default: /* K_CORNERS_SYM */
      return (uint64_t)CpermSym.cls[co->cp] * NTWIST + TwistConj[co->tw[0]][CpermSym.sym[co->cp]];
  }
}

static uint64_t lookup_index_slow(const Lookup *L, const Cube *x) {
  Cube a, y;
  if (L->inv)
    inverse(x, &a);
  else
    a = *x;
  sym_conj(&a, L->sym, &y);
  return table_index(L->T, &y);
}

static void lookup_prepare(Lookup *L) {
  if (L->T->kind != K_EDGES) return;
  const Cube *S = &SYM[L->sym], *Si = &SYM[SYMINV[L->sym]];
  for (int j = 0; j < L->T->k; j++) {
    int a = L->T->cub[j], c = Si->ep[a];
    L->ec[j] = (uint8_t)c;
    L->eco[j] = S->eo[c];
  }
  for (int q = 0; q < 12; q++) L->ypos[q] = S->ep[q];
  for (int i = 0; i < 12; i++) L->epo[i] = Si->eo[i];
}

/* The set of x-edges a symmetric edge lookup tracks, as a bitmask. */
static int edge_set(const Table *T, int s) {
  int m = 0;
  for (int j = 0; j < T->k; j++) m |= 1 << SYM[SYMINV[s]].ep[T->cub[j]];
  return m;
}

/*
 * Floor tokens, joined with '+':
 *   Kt Kf Ks Kts Kfs Ktf   Kociemba coordinates (twist, flip, UD-slice) and pairs of them
 *   P1                     phase-1 coordinate twist x flip x slice, 16-symmetry reduced
 *   C8 / C8s               all 8 corners, full table / 16-symmetry reduced (same values)
 *   E6 / E7                6 or 7 edges with orientation
 * Suffixes: xN  N lookups through symmetry (K and P1: x3 = the three axes; E: x2 = the
 *               tracked set and one covering the rest, x8 / x24 = every distinct set under
 *               the 16 / 48 symmetries)
 *           i   also look up the inverse position
 *           @2  read the 2-bit (distance mod 3) table instead of the 4-bit one
 */
static void parse_floor(const char *spec, Floor *F) {
  memset(F, 0, sizeof *F);
  snprintf(F->name, sizeof F->name, "%s", spec);
  char buf[256];
  snprintf(buf, sizeof buf, "%s", spec);
  int ntok = 0;
  for (char *tok = strtok(buf, "+"); tok; tok = strtok(NULL, "+"), ntok++) {
    static const struct {
      const char *tok, *table;
    } names[] = {{"Kts", "twist_slice"}, {"Kfs", "flip_slice"}, {"Ktf", "twist_flip"}, {"Kt", "twist"},
                 {"Kf", "flip"},         {"Ks", "slice"},       {"P1", "phase1_sym"}, {"C8s", "corners_sym"},
                 {"C8", "corners"},      {"E6", "edges6"},      {"E7", "edges7"}};
    Table *T = NULL;
    char *p = tok;
    for (size_t i = 0; i < sizeof names / sizeof names[0]; i++) {
      size_t l = strlen(names[i].tok);
      if (!strncmp(tok, names[i].tok, l)) {
        T = table_by_name(names[i].table);
        p = tok + l;
        break;
      }
    }
    if (!T) die("unknown floor token");
    int mult = 1, inv = 0, bits = 4;
    if (*p == 'x') mult = (int)strtol(p + 1, &p, 10);
    if (*p == 'i') inv = 1, p++;
    if (*p == '@') bits = (int)strtol(p + 1, &p, 10);
    if (*p || (bits != 2 && bits != 4)) die("bad floor token suffix");
    if (bits == 2 && inv) die("2-bit tables need the parent's exact value, which an inverse lookup lacks");
    table_init(T);
    load_table(T, bits);
    int syms[48], ns = 0;
    if (T->kind == K_EDGES) {
      int seen[48], nseen = 0, full = (1 << 12) - 1, a = edge_set(T, 0);
      syms[ns++] = 0;
      seen[nseen++] = a;
      if (mult == 2) {
        for (int s = 1; s < 48 && ns < 2; s++)
          if ((edge_set(T, s) | a) == full) syms[ns++] = s;
      } else if (mult > 1) {
        for (int s = 1; s < (mult <= 8 ? 16 : 48) && ns < mult; s++) {
          int e = edge_set(T, s), dup = 0;
          for (int i = 0; i < nseen; i++) dup |= seen[i] == e;
          if (!dup) syms[ns++] = s, seen[nseen++] = e;
        }
      }
    } else if (mult == 3) {
      syms[ns++] = 0, syms[ns++] = 16, syms[ns++] = 32;
    } else {
      syms[ns++] = 0;
    }
    if (ns != mult) die("cannot find that many distinct symmetric lookups");
    for (int v = 0; v <= inv; v++)
      for (int i = 0; i < ns; i++) {
        Lookup *L = &F->L[F->nl++];
        L->T = T, L->bits = bits, L->sym = syms[i], L->inv = v, L->token = ntok;
        lookup_prepare(L);
        L->axis = -1;
        int corner = T->kind == K_CORNERS || T->kind == K_CORNERS_SYM;
        if (!v && T->kind != K_EDGES && (L->sym == 0 || (!corner && (L->sym == 16 || L->sym == 32))))
          L->axis = L->sym / 16;
        if (L->axis >= 0) F->axmask |= 1 << L->axis;
        if (v) F->needs_inv = 1;
        if (F->nl > 90) die("too many lookups");
      }
  }
  /* Stable partition: direct lookups first. */
  Lookup tmp[96];
  int w = 0;
  for (int pass = 0; pass < 2; pass++)
    for (int l = 0; l < F->nl; l++)
      if (F->L[l].inv == pass) tmp[w++] = F->L[l];
  memcpy(F->L, tmp, sizeof(Lookup) * (size_t)F->nl);
  F->n1 = 0;
  while (F->n1 < F->nl && !F->L[F->n1].inv) F->n1++;
  F->ng = 0;
  for (int l = 0; l < F->nl; l++)
    if (!l || F->L[l].token != F->L[l - 1].token || F->L[l].inv != F->L[l - 1].inv) F->gs[F->ng++] = l;
  F->gs[F->ng] = F->nl;
}

static size_t floor_bytes(const Floor *F, size_t *aux) {
  size_t b = 0, a = 0;
  for (int i = 0; i < F->nl; i++) {
    int dup = 0;
    for (int j = 0; j < i; j++) dup |= F->L[j].T == F->L[i].T && F->L[j].bits == F->L[i].bits;
    if (dup) continue;
    b += table_bytes(F->L[i].T, F->L[i].bits);
    int dupa = 0;
    for (int j = 0; j < i; j++) dupa |= F->L[j].T == F->L[i].T;
    if (!dupa) a += aux_bytes(F->L[i].T);
  }
  if (aux) *aux = a;
  return b;
}

/* Exact value of a lookup from a 2-bit table: walk down to the goal, one step at a time. */
static int exact_mod3(const Lookup *L, const Cube *x) {
  Cube y = *x, z;
  int v = 0;
  for (;;) {
    uint64_t i = lookup_index_slow(L, &y);
    if (i == L->T->goal) return v;
    int r = get2(L->T, i), m;
    for (m = 0; m < 18; m++) {
      mul(&y, &MV[m], &z);
      if (get2(L->T, lookup_index_slow(L, &z)) == (r + 2) % 3) break;
    }
    if (m == 18 || ++v > 20) die("mod-3 descent failed");
    y = z;
  }
}

/* Exact value of every lookup at a position (the search root). */
static void floor_values(const Floor *F, const Cube *x, int *hv) {
  for (int l = 0; l < F->nl; l++) {
    const Lookup *L = &F->L[l];
    hv[l] = L->bits == 4 ? get4(L->T, lookup_index_slow(L, x)) : exact_mod3(L, x);
  }
}

/* ------------------------------------------------------------------ IDA* */

typedef struct {
  const Floor *F;
  uint64_t nodes, maxnodes;
  int aborted;
  int path[32];
  uint8_t root_moves[18];
  int nroot;
  volatile int *stop; /* set when another thread found a solution (split mode) */
} Search;

/* Same face twice never helps; of two opposite faces, take the lower first. lastf < 0: no move yet.
 * lastf >= 6: only the same-face rule (after a symmetry-reduced first move, see root_symmetry). */
static inline int skip_face(int f, int lastf) { return lastf >= 6 ? f == lastf - 6 : (f == lastf || f + 3 == lastf); }

static inline int next_lastf(const Search *S, int g, int f) { return g == 0 && S->nroot < 18 ? f + 6 : f; }

static inline void prefetch_entry(const Lookup *L, uint64_t i) {
  __builtin_prefetch(L->bits == 4 ? &L->T->v4[i >> 1] : &L->T->v2[i >> 2]);
}

static inline int entry_value(const Lookup *L, uint64_t i, int parent) {
  if (L->bits == 4) return get4(L->T, i);
  int d = (get2(L->T, i) - parent % 3 + 3) % 3;
  return d == 0 ? parent : d == 1 ? parent + 1 : parent - 1;
}

/* x: the position after g moves, rem = bound - g moves left, x's floor <= rem. hv: x's exact lookups.
 * Nodes counts every child generated (a position whose floor was looked up or tested). */
static int dfs(Search *S, const Cube *x, const Coords *cx, int g, int rem, int lastf, const int *hv) {
  if (rem == 0) return same(x, &SOLVED);
  int nm = g == 0 ? S->nroot : 18;
  if (rem == 1) {
    /* Only the solved position has floor 0 at every lookup worth trusting here: test it directly. */
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
  Cube ys[18];
  Coords cs[18];
  NodeCache ncs[18];
  int ms[18], nc = 0, hv2[18][96];
  for (int mi = 0; mi < nm; mi++) {
    int m = g == 0 ? S->root_moves[mi] : mi;
    if (skip_face(m / 3, lastf)) continue;
    mul(x, &MV[m], &ys[nc]);
    coords_move(cx, m, &cs[nc], F->axmask);
    ncs[nc].x = &ys[nc], ncs[nc].have_inv = 0, ncs[nc].have_pos[0] = ncs[nc].have_pos[1] = 0, ncs[nc].ncj = 0;
    ms[nc++] = m;
  }
  S->nodes += (uint64_t)nc;
  /* Read the lookups group by group. For each group, first compute and prefetch every surviving
   * child's entries, then prune; a child pruned by an early group never touches the later tables. */
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
  for (int a = 0; a < na; a++) {
    int i = alive[a];
    S->path[g] = ms[i];
    if (dfs(S, &ys[i], &cs[i], g + 1, rem - 1, next_lastf(S, g, ms[i] / 3), hv2[i])) return 1;
    if (S->nodes > S->maxnodes) {
      S->aborted = 1;
      return 0;
    }
    if (S->stop && *S->stop) return 0;
  }
  return 0;
}

/* First moves, one per orbit of the root's own symmetries (superflip has all 48): if w solves x and
 * s fixes x, then s w s^-1 solves x too. The second move then only avoids the first move's face. */
static int root_symmetry(Search *S, const Cube *x) {
  int stab[48], ns = 0;
  for (int s = 0; s < 48; s++) {
    Cube y;
    sym_conj(x, s, &y);
    if (same(&y, x)) stab[ns++] = s;
  }
  S->nroot = 0;
  for (int m = 0; m < 18; m++) {
    int rep = m;
    for (int i = 0; i < ns; i++)
      if (SYMMOVE[stab[i]][m] < rep) rep = SYMMOVE[stab[i]][m];
    if (rep == m) S->root_moves[S->nroot++] = (uint8_t)m;
  }
  return ns;
}

/* Split mode: the nodes at depth sd become tasks that the threads share. */
typedef struct {
  Cube c;
  Coords co;
  int lastf;
  int hv[96];
  int path[8];
} Task;

static void collect(Search *S, const Cube *x, const Coords *cx, int g, int sd, int rem, int lastf, const int *hv,
                    int *path, Task **tasks, int *nt, int *cap) {
  if (g == sd) {
    if (*nt == *cap) *tasks = realloc(*tasks, sizeof(Task) * (size_t)(*cap *= 2));
    Task *t = &(*tasks)[(*nt)++];
    t->c = *x, t->co = *cx, t->lastf = lastf;
    memcpy(t->hv, hv, sizeof t->hv);
    memcpy(t->path, path, sizeof t->path);
    return;
  }
  const Floor *F = S->F;
  int nm = g == 0 ? S->nroot : 18;
  for (int mi = 0; mi < nm; mi++) {
    int m = g == 0 ? S->root_moves[mi] : mi;
    if (skip_face(m / 3, lastf)) continue;
    Cube y;
    Coords cy;
    mul(x, &MV[m], &y);
    coords_move(cx, m, &cy, F->axmask);
    S->nodes++;
    NodeCache c;
    c.x = &y, c.have_inv = 0, c.have_pos[0] = c.have_pos[1] = 0, c.ncj = 0;
    int hv2[96], ok = 1;
    for (int l = 0; l < F->nl && ok; l++) {
      hv2[l] = entry_value(&F->L[l], lookup_index_c(&F->L[l], &c, &cy), hv[l]);
      ok = hv2[l] <= rem - 1;
    }
    if (!ok) continue;
    path[g] = m;
    collect(S, &y, &cy, g + 1, sd, rem - 1, next_lastf(S, g, m / 3), hv2, path, tasks, nt, cap);
  }
}

static int VERBOSE;

typedef struct {
  int length, h0, nstab;
  uint64_t nodes, per_bound[32];
  double secs;
  int aborted;
  int path[32];
} Result;

static void solve(const Floor *F, const Cube *x, uint64_t maxnodes, Result *R, int split) {
  Search S;
  memset(&S, 0, sizeof S);
  memset(R, 0, sizeof *R);
  S.F = F;
  S.maxnodes = maxnodes;
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
    uint64_t before = S.nodes;
    int found;
    if (split && bound > split + 1) {
      int cap = 1024, nt = 0, path[8] = {0};
      Task *tasks = malloc(sizeof(Task) * (size_t)cap);
      collect(&S, x, &cx, 0, split, bound, -1, hv, path, &tasks, &nt, &cap);
      volatile int stop = 0;
      uint64_t sub = 0, budget = maxnodes > S.nodes ? maxnodes - S.nodes : 0;
      int winner = -1, aborted = 0, wpath[32];
#pragma omp parallel for schedule(dynamic, 1) reduction(+ : sub) reduction(| : aborted)
      for (int t = 0; t < nt; t++) {
        if (stop) continue;
        Search T = S;
        T.nodes = 0, T.stop = &stop, T.maxnodes = budget;
        memcpy(T.path, tasks[t].path, sizeof tasks[t].path);
        int ok = dfs(&T, &tasks[t].c, &tasks[t].co, split, bound - split, tasks[t].lastf, tasks[t].hv);
        sub += T.nodes;
        aborted |= T.aborted;
        if (ok) {
#pragma omp critical
          if (winner < 0) {
            winner = t;
            memcpy(wpath, T.path, sizeof wpath);
            stop = 1;
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
    if (VERBOSE) fprintf(stderr, "    bound %d: %llu nodes, %.1fs\n", bound, (unsigned long long)R->per_bound[bound], now() - t0);
    if (found) {
      R->length = bound;
      memcpy(R->path, S.path, sizeof S.path);
      break;
    }
    if (S.aborted) break;
  }
  R->nodes = S.nodes;
  R->aborted = S.aborted;
  R->secs = now() - t0;
}

/* ------------------------------------------------------------- utilities */

static int parse_moves(const char *s, int *out) {
  int n = 0;
  while (*s) {
    while (*s == ' ' || *s == '\t' || *s == '\n' || *s == '\r') s++;
    if (!*s) break;
    const char *faces = "URFDLB", *f = strchr(faces, *s);
    if (!f) return -1;
    int k = 0;
    s++;
    if (*s == '2') k = 1, s++;
    if (*s == '\'') k = k ? 1 : 2, s++;
    out[n++] = (int)(f - faces) * 3 + k;
  }
  return n;
}

static void apply(Cube *c, const int *mv, int n) {
  Cube t;
  for (int i = 0; i < n; i++) {
    mul(c, &MV[mv[i]], &t);
    *c = t;
  }
}

static uint64_t rng_state = 0x9e3779b97f4a7c15ull;
static uint64_t rnd(void) {
  uint64_t z = (rng_state += 0x9e3779b97f4a7c15ull);
  z = (z ^ (z >> 30)) * 0xbf58476d1ce4e5b9ull;
  z = (z ^ (z >> 27)) * 0x94d049bb133111ebull;
  return z ^ (z >> 31);
}
static int parity(const uint8_t *p, int n) {
  int s = 0;
  for (int i = 0; i < n; i++)
    for (int j = i + 1; j < n; j++) s ^= p[i] > p[j];
  return s;
}
/* A uniformly random position. */
static void random_cube(Cube *c) {
  *c = SOLVED;
  perm_unrank((uint32_t)(rnd() % NCPERM), c->cp, 8);
  do perm_unrank((uint32_t)(rnd() % 479001600u), c->ep, 12);
  while (parity(c->ep, 12) != parity(c->cp, 8));
  set_twist(c, (int)(rnd() % NTWIST));
  set_flip(c, (int)(rnd() % NFLIP));
}

/* ---------------------------------------------------------------- commands */

static int cmd_build(int argc, char **argv) {
  for (int a = 0; a < argc; a++) {
    for (int i = 0; i < NTABLES; i++) {
      if (strcmp(argv[a], "all") && strcmp(argv[a], TABLES[i].name)) continue;
      struct stat st;
      if (!strcmp(argv[a], "all") && stat(table_path(&TABLES[i], 4), &st) == 0) {
        fprintf(stderr, "build %s: exists, skipped\n", TABLES[i].name);
        continue;
      }
      build_table(&TABLES[i]);
    }
  }
  return 0;
}

static int cmd_selftest(void) {
  int bad = 0;
  /* Symmetries: the 16 U-D symmetries fix the slice, and twist conjugation ignores the permutation. */
  for (int s = 0; s < 16; s++) {
    Cube y;
    sym_conj(&SOLVED, s, &y);
    bad += !same(&y, &SOLVED);
  }
  need_cperm_sym();
  need_flipslice_sym();
  fprintf(stderr, "classes: corner permutation %u (expect 2768), flip x slice %u (expect 64430)\n", CpermSym.nclass,
          FlipSliceSym.nclass);
  bad += CpermSym.nclass != 2768 || FlipSliceSym.nclass != 64430;
  for (int trial = 0; trial < 200000; trial++) {
    Cube x, y;
    random_cube(&x);
    int s = (int)(rnd() % 16);
    sym_conj(&x, s, &y);
    bad += twist_of(&y) != TwistConj[twist_of(&x)][s];
    bad += (uint32_t)slice_of(&y) * NFLIP + (uint32_t)flip_of(&y) !=
           conj_flipslice((uint32_t)slice_of(&x) * NFLIP + (uint32_t)flip_of(&x), s);
    bad += (uint32_t)cperm_of(&y) != conj_cperm((uint32_t)cperm_of(&x), s);
  }
  /* Fast lookups agree with the slow path for every symmetry, with and without inverse. */
  for (int t = 0; t < NTABLES; t++) {
    Table *T = &TABLES[t];
    table_init(T);
    for (int s = 0; s < 48; s++)
      for (int inv = 0; inv < 2; inv++) {
        if (T->kind == K_CORNERS_SYM && s) continue;
        Lookup L;
        memset(&L, 0, sizeof L);
        L.T = T, L.sym = s, L.inv = inv, L.bits = 4;
        lookup_prepare(&L);
        for (int trial = 0; trial < 300; trial++) {
          Cube x;
          random_cube(&x);
          NodeCache nc;
          memset(&nc, 0, sizeof nc);
          nc.x = &x;
          bad += lookup_index(&L, &nc) != lookup_index_slow(&L, &x);
        }
      }
  }
  /* Neighbours in each table's graph match turning a real cube. */
  for (int t = 0; t < NTABLES; t++) {
    Table *T = &TABLES[t];
    for (int trial = 0; trial < 2000; trial++) {
      Cube x, y;
      random_cube(&x);
      uint64_t out[18 * 16];
      int k = neighbours(T, table_index(T, &x), out);
      for (int m = 0; m < 18; m++) {
        mul(&x, &MV[m], &y);
        uint64_t want = table_index(T, &y);
        int found = 0;
        for (int j = 0; j < k; j++) found |= out[j] == want;
        bad += !found;
      }
    }
  }
  /* Carried coordinates match recomputing them, and coordinate lookups match the slow path. */
  {
    Floor F;
    parse_floor("Ktsx3+Kfsx3+Ktfx3+Ktx3+Kfx3+Ksx3+P1x3+C8+C8s", &F);
    for (int trial = 0; trial < 100000; trial++) {
      Cube x, y;
      random_cube(&x);
      Coords c, d, e;
      coords_of(&x, &c);
      int m = (int)(rnd() % 18);
      mul(&x, &MV[m], &y);
      coords_move(&c, m, &d, 7);
      coords_of(&y, &e);
      bad += memcmp(&d, &e, sizeof d) != 0;
      NodeCache nc;
      memset(&nc, 0, sizeof nc);
      nc.x = &y;
      for (int l = 0; l < F.nl; l++) bad += lookup_index_c(&F.L[l], &nc, &d) != lookup_index_slow(&F.L[l], &y);
    }
  }
  /* Superflip is fixed by all 48 symmetries. */
  Cube sf = SOLVED;
  for (int i = 0; i < 12; i++) sf.eo[i] = 1;
  int ns = 0;
  for (int s = 0; s < 48; s++) {
    Cube y;
    sym_conj(&sf, s, &y);
    ns += same(&y, &sf);
  }
  bad += ns != 48;
  fprintf(stderr, "selftest: %s (%d failures)\n", bad ? "FAILED" : "ok", bad);
  return bad != 0;
}

/* Position key for the exhaustive check: corners, flip and edge permutation in 67 bits. */
typedef unsigned __int128 Key;
static Key key_of(const Cube *c) {
  uint64_t k1 = ((uint64_t)cperm_of(c) * NTWIST + (uint64_t)twist_of(c)) * NFLIP + (uint64_t)flip_of(c);
  return ((Key)k1 << 29) | perm_rank(c->ep, 12);
}
static void cube_of(Key k, Cube *c) {
  *c = SOLVED;
  perm_unrank((uint32_t)(k & ((1u << 29) - 1)), c->ep, 12);
  uint64_t k1 = (uint64_t)(k >> 29);
  set_flip(c, (int)(k1 % NFLIP));
  k1 /= NFLIP;
  set_twist(c, (int)(k1 % NTWIST));
  perm_unrank((uint32_t)(k1 / NTWIST), c->cp, 8);
}
static int key_cmp(const void *a, const void *b) {
  Key x = *(const Key *)a, y = *(const Key *)b;
  return x < y ? -1 : x > y;
}
static int key_in(const Key *arr, size_t n, Key k) {
  size_t lo = 0, hi = n;
  while (lo < hi) {
    size_t mid = (lo + hi) / 2;
    if (arr[mid] < k)
      lo = mid + 1;
    else
      hi = mid;
  }
  return lo < n && arr[lo] == k;
}

static int cmd_verify(int argc, char **argv) {
  int maxd = 6, nida = 1;
  if (argc && !strncmp(argv[0], "--ida=", 6)) nida = atoi(argv[0] + 6), argc--, argv++;
  if (nida > argc) nida = argc;
  Floor *F = calloc((size_t)argc, sizeof(Floor));
  for (int a = 0; a < argc; a++) {
    parse_floor(argv[a], &F[a]);
    for (int l = 0; l < F[a].nl; l++) load_table(F[a].L[l].T, 4);
  }
  /* Breadth-first search over whole positions: layers[d] holds every position at distance d. */
  Key *layer[8];
  size_t nl[8];
  layer[0] = malloc(sizeof(Key));
  layer[0][0] = key_of(&SOLVED);
  nl[0] = 1;
  double t0 = now();
  for (int d = 0; d < maxd; d++) {
    size_t cap = nl[d] * 18;
    Key *next = malloc(cap * sizeof(Key));
#pragma omp parallel for schedule(static)
    for (size_t i = 0; i < nl[d]; i++) {
      Cube c, y;
      cube_of(layer[d][i], &c);
      for (int m = 0; m < 18; m++) {
        mul(&c, &MV[m], &y);
        next[i * 18 + (size_t)m] = key_of(&y);
      }
    }
    qsort(next, cap, sizeof(Key), key_cmp);
    size_t w = 0;
    for (size_t i = 0; i < cap; i++) {
      if (i && next[i] == next[i - 1]) continue;
      if (key_in(layer[d], nl[d], next[i])) continue;
      if (d && key_in(layer[d - 1], nl[d - 1], next[i])) continue;
      next[w++] = next[i];
    }
    layer[d + 1] = next;
    nl[d + 1] = w;
    fprintf(stderr, "distance %d: %zu positions (%.1fs)\n", d + 1, w, now() - t0);
  }
  printf("{\"max_distance\": %d, \"positions_per_distance\": [", maxd);
  for (int d = 0; d <= maxd; d++) printf("%s%zu", d ? ", " : "", nl[d]);
  printf("], \"floors\": [\n");
  for (int a = 0; a < argc; a++) {
    uint64_t viol = 0, checked = 0, mismatch = 0, sum[8] = {0};
    int worst = -99, hmax[8] = {0};
    for (int d = 0; d <= maxd; d++) {
      uint64_t v = 0, mm = 0, s = 0;
      int w = -99, hm = 0;
#pragma omp parallel for schedule(dynamic, 4096) reduction(+ : v, mm, s) reduction(max : w, hm)
      for (size_t i = 0; i < nl[d]; i++) {
        Cube c;
        cube_of(layer[d][i], &c);
        NodeCache nc;
        memset(&nc, 0, sizeof nc);
        nc.x = &c;
        int h = 0;
        for (int l = 0; l < F[a].nl; l++) {
          const Lookup *L = &F[a].L[l];
          uint64_t fast = lookup_index(L, &nc), slow = lookup_index_slow(L, &c);
          mm += fast != slow;
          /* 2-bit lookups are checked through their 4-bit twin; both come from one search. */
          int val = get4(L->T, slow);
          if (L->bits == 2) mm += get2(L->T, slow) != val % 3;
          if (val > h) h = val;
          if (val > d) v++;
          if (val - d > w) w = val - d;
        }
        s += (uint64_t)h;
        if (h > hm) hm = h;
      }
      viol += v, mismatch += mm, checked += nl[d], sum[d] = s, hmax[d] = hm;
      if (w > worst) worst = w;
    }
    printf("  {\"floor\": \"%s\", \"lookups\": %d, \"positions\": %llu, \"violations\": %llu, ", F[a].name, F[a].nl,
           (unsigned long long)checked, (unsigned long long)viol);
    printf("\"max_floor_minus_distance\": %d, \"fast_slow_mismatches\": %llu, \"mean_floor_by_distance\": [", worst,
           (unsigned long long)mismatch);
    for (int d = 0; d <= maxd; d++) printf("%s%.4f", d ? ", " : "", (double)sum[d] / (double)nl[d]);
    printf("], \"max_floor_by_distance\": [");
    for (int d = 0; d <= maxd; d++) printf("%s%d", d ? ", " : "", hmax[d]);
    printf("]}%s\n", a + 1 < argc ? "," : "");
    fflush(stdout);
    fprintf(stderr, "%-28s violations %llu, mismatches %llu (%.1fs)\n", F[a].name, (unsigned long long)viol,
            (unsigned long long)mismatch, now() - t0);
  }
  /* The search itself: optimal length equals the true distance, for the first nida floors,
   * every position at distance <= 4 and 3,000 sampled at 5 and 6. */
  printf("], \"ida_check\": [\n");
  for (int a = 0; a < nida; a++) {
    printf("  {\"floor\": \"%s\", \"per_distance\": [", F[a].name);
    int all_ok = 1;
    for (int d = 0; d <= maxd; d++) {
      size_t n = nl[d] < 50000 ? nl[d] : 3000;
      int ok = 0;
#pragma omp parallel for schedule(dynamic, 16) reduction(+ : ok)
      for (size_t i = 0; i < n; i++) {
        size_t j = n == nl[d] ? i : (size_t)(((uint64_t)i * 2654435761u) % nl[d]);
        Cube c, z;
        cube_of(layer[d][j], &c);
        Result R;
        solve(&F[a], &c, 1ull << 40, &R, 0);
        z = c;
        apply(&z, R.path, R.length);
        ok += R.length == d && same(&z, &SOLVED);
      }
      all_ok &= ok == (int)n;
      printf("%s{\"distance\": %d, \"solved\": %zu, \"optimal\": %d}", d ? ", " : "", d, n, ok);
    }
    printf("], \"all_optimal\": %s}%s\n", all_ok ? "true" : "false", a + 1 < nida ? "," : "");
    fprintf(stderr, "ida check %s: %s\n", F[a].name, all_ok ? "ok" : "FAILED");
  }
  printf("]}\n");
  return 0;
}

static int cmd_stats(int argc, char **argv) {
  int samples = 1000000;
  printf("[\n");
  for (int a = 0; a < argc; a++) {
    Floor F;
    parse_floor(argv[a], &F);
    for (int l = 0; l < F.nl; l++) load_table(F.L[l].T, 4);
    uint64_t hist[21] = {0};
    rng_state = 12345;
    Cube *xs = malloc(sizeof(Cube) * (size_t)samples);
    for (int i = 0; i < samples; i++) random_cube(&xs[i]);
#pragma omp parallel for schedule(static)
    for (int i = 0; i < samples; i++) {
      int h = 0;
      for (int l = 0; l < F.nl; l++) {
        const Lookup *L = &F.L[l];
        int v = get4(L->T, lookup_index_slow(L, &xs[i]));
        if (v > h) h = v;
      }
#pragma omp atomic
      hist[h]++;
    }
    /* Lookup speed: the search's fast path on one thread, all lookups, no early exit. */
    double t0 = now();
    uint64_t sink = 0;
    int reps = 2000000;
    for (int i = 0; i < reps; i++) {
      NodeCache nc;
      nc.x = &xs[i % samples], nc.have_inv = 0, nc.have_pos[0] = nc.have_pos[1] = 0, nc.ncj = 0;
      for (int l = 0; l < F.nl; l++) sink += (uint64_t)get4(F.L[l].T, lookup_index(&F.L[l], &nc));
    }
    double ns = (now() - t0) / reps * 1e9;
    double mean = 0;
    for (int h = 0; h <= 20; h++) mean += h * (double)hist[h];
    mean /= samples;
    size_t aux, bytes = floor_bytes(&F, &aux);
    printf("  {\"floor\": \"%s\", \"lookups\": %d, \"bytes\": %zu, \"aux_bytes\": %zu, \"mean_random\": %.4f, ", F.name,
           F.nl, bytes, aux, mean);
    printf("\"ns_per_eval\": %.1f, \"sink\": %llu, \"hist\": [", ns, (unsigned long long)(sink & 1));
    for (int h = 0; h <= 20; h++) printf("%s%llu", h ? ", " : "", (unsigned long long)hist[h]);
    printf("]}%s\n", a + 1 < argc ? "," : "");
    fflush(stdout);
    fprintf(stderr, "%-24s mean %.3f  %.0f ns/eval\n", F.name, mean, ns);
    free(xs);
  }
  printf("]\n");
  return 0;
}

static int cmd_solve(int argc, char **argv) {
  if (argc < 2) die("usage: cube3 solve <floor> <scrambles.txt> [maxnodes]");
  Floor F;
  double tl = now();
  parse_floor(argv[0], &F);
  double load_s = now() - tl;
  uint64_t maxnodes = argc > 2 ? strtoull(argv[2], NULL, 10) : 2000000000ull;
  /* CUBE3_SPLIT=d: run each solve on all threads, sharing the subtrees at depth d. */
  int split = getenv("CUBE3_SPLIT") ? atoi(getenv("CUBE3_SPLIT")) : 0;
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
  fprintf(stderr, "floor %s: %d lookups, %.1f MB (+%.1f MB index), loaded in %.1fs\n", F.name, F.nl, bytes / 1e6,
          aux / 1e6, load_s);
  printf("{\"type\": \"meta\", \"floor\": \"%s\", \"lookups\": %d, \"bytes\": %zu, \"aux_bytes\": %zu, ", F.name, F.nl,
         bytes, aux);
  printf("\"load_seconds\": %.3f, \"threads\": %d, \"split\": %d, \"maxnodes\": %llu}\n", load_s,
         omp_get_max_threads(), split, (unsigned long long)maxnodes);
  fflush(stdout);
#pragma omp parallel for schedule(dynamic, 1) if (!split)
  for (int i = 0; i < n; i++) {
    int mv[64];
    int k = parse_moves(lines[i], mv);
    if (k < 0) die("bad scramble");
    Cube c = SOLVED, z;
    apply(&c, mv, k);
    Result R;
    solve(&F, &c, maxnodes, &R, split);
    z = c;
    int ok = R.length >= 0;
    if (ok) apply(&z, R.path, R.length);
    ok = ok && same(&z, &SOLVED);
    char sol[256] = "";
    for (int j = 0; j < R.length; j++) {
      strcat(sol, MOVENAME[R.path[j]]);
      if (j + 1 < R.length) strcat(sol, " ");
    }
#pragma omp critical
    {
      printf("{\"type\": \"solve\", \"index\": %d, \"scramble\": \"%s\", \"length\": %d, \"solution\": \"%s\", ", i,
             lines[i], R.length, sol);
      printf("\"verified\": %s, \"dnf\": %s, \"h0\": %d, \"root_symmetries\": %d, \"nodes\": %llu, \"seconds\": %.4f, ",
             ok ? "true" : "false", R.aborted ? "true" : "false", R.h0, R.nstab, (unsigned long long)R.nodes, R.secs);
      printf("\"nodes_per_bound\": {");
      int first = 1;
      for (int b = 0; b < 32; b++)
        if (R.per_bound[b]) printf("%s\"%d\": %llu", first ? "" : ", ", b, (unsigned long long)R.per_bound[b]), first = 0;
      printf("}}\n");
      fflush(stdout);
      fprintf(stderr, "  #%d len %d nodes %llu %.2fs%s\n", i, R.length, (unsigned long long)R.nodes, R.secs,
              R.aborted ? " DNF" : "");
    }
  }
  return 0;
}

#include "gravity.inc"
#include "ceiling.inc"
#include "combined.inc"

int main(int argc, char **argv) {
  if (getenv("CUBE3_TABLES")) TABLE_DIR = getenv("CUBE3_TABLES");
  VERBOSE = getenv("CUBE3_VERBOSE") != NULL;
  init_cube();
  init_coords();
  init_conjmap();
  if (argc < 2) die("usage: cube3 build|selftest|verify|stats|solve ...");
  init_pch();
  if (!strcmp(argv[1], "masks")) return cmd_masks(argc - 2, argv + 2);
  if (!strcmp(argv[1], "maskcheck")) return cmd_maskcheck(argc - 2, argv + 2);
  if (!strcmp(argv[1], "gsolve")) return cmd_gsolve(argc - 2, argv + 2);
  if (!strcmp(argv[1], "ceil")) return cmd_ceil(argc - 2, argv + 2);
  if (!strcmp(argv[1], "comb")) return cmd_comb(argc - 2, argv + 2);
  if (!strcmp(argv[1], "build")) return cmd_build(argc - 2, argv + 2);
  if (!strcmp(argv[1], "selftest")) return cmd_selftest();
  if (!strcmp(argv[1], "verify")) return cmd_verify(argc - 2, argv + 2);
  if (!strcmp(argv[1], "stats")) return cmd_stats(argc - 2, argv + 2);
  if (!strcmp(argv[1], "solve")) return cmd_solve(argc - 2, argv + 2);
  die("unknown command");
}
