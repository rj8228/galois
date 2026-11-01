/*
 * core.c (T8): T5's lab/speed/browser/src/core.c, built as a threads module (shared wasm memory,
 * atomics) so every Web Worker instantiates it on ONE memory holding ONE copy of the tables, plus
 * T6's two-phase ceiling solver (lab/speed/ceiling/src/ceiling.inc), bottom of this file.
 * T8 changes: the bump allocator takes a spinlock; per-solve state lives in a Ctx per worker (all C
 * globals are shared); a control block (stop flag, ceiling, proven bound, task counter) is shared.
 * The search code (dfs, lookups, coordinates, moves) is unchanged from T5, which copied lab/3x3.
 *
 * T5's header follows.
 * core.c: lab/3x3/src/cube3.c compiled freestanding for wasm32 (clang --target=wasm32, no libc).
 *
 * The cube model, coordinates, symmetry reduction, table builder (breadth-first search), floor
 * lookups and IDA* are copied unchanged from lab/3x3/src/cube3.c (sections marked "copied").
 * What differs:
 *   - no stdio/malloc/OpenMP: memory is a bump allocator over memory.grow; die() and now() are JS
 *     imports; tables are built here or copied in by JS (no files, no mmap)
 *   - build_symcoord computes conjugates on the fly instead of a 16 x nraw scratch array (same result)
 *   - the solve loop lives in JS (bench/worker.js) so the subtrees of one bound can be split across
 *     Web Workers; exported entry points are at the bottom
 */
#include <stdint.h>
#include <stddef.h>

#define EXPORT(name) __attribute__((export_name(#name)))
#define IMPORT(name) __attribute__((import_module("env"), import_name(#name)))

IMPORT(js_die) void js_die(const char *msg);
IMPORT(js_log) void js_log(const char *msg, double a, double b);
IMPORT(js_now) double js_now(void); /* seconds */
static double now(void) { return js_now(); }

/* ---------------------------------------------------------- freestanding libc */

/* Built with -mbulk-memory, so these become the memory.copy / memory.fill instructions. */
void *memcpy(void *d, const void *s, size_t n) { return __builtin_memcpy(d, s, n); }
void *memmove(void *d, const void *s, size_t n) { return __builtin_memmove(d, s, n); }
void *memset(void *d, int c, size_t n) { return __builtin_memset(d, c, n); }
int memcmp(const void *x, const void *y, size_t n) {
  const uint8_t *a = x, *b = y;
  for (; n; n--, a++, b++)
    if (*a != *b) return *a - *b;
  return 0;
}
static size_t strlen(const char *s) {
  size_t n = 0;
  while (s[n]) n++;
  return n;
}
static int strcmp(const char *a, const char *b) {
  while (*a && *a == *b) a++, b++;
  return (uint8_t)*a - (uint8_t)*b;
}
static int strncmp(const char *a, const char *b, size_t n) {
  for (; n; n--, a++, b++) {
    if (*a != *b) return (uint8_t)*a - (uint8_t)*b;
    if (!*a) return 0;
  }
  return 0;
}
static long strtol10(const char *s, char **end) {
  long v = 0;
  while (*s >= '0' && *s <= '9') v = v * 10 + (*s++ - '0');
  *end = (char *)s;
  return v;
}

extern unsigned char __heap_base;
static uintptr_t heap_top;
static void die(const char *msg) {
  js_die(msg);
  __builtin_trap();
}
/* T8: shared by every worker, so allocation takes a spinlock (memory.grow itself is atomic). */
static volatile int heap_lock;
static void *malloc(size_t n) {
  while (__atomic_exchange_n(&heap_lock, 1, __ATOMIC_ACQUIRE)) {
  }
  if (!heap_top) heap_top = (uintptr_t)&__heap_base;
  heap_top = (heap_top + 15) & ~(uintptr_t)15;
  uintptr_t p = heap_top, end = p + n;
  size_t have = __builtin_wasm_memory_size(0) * 65536ull;
  if (end > have) {
    size_t pages = (end - have + 65535) / 65536;
    if (__builtin_wasm_memory_grow(0, pages) == (size_t)-1) {
      __atomic_store_n(&heap_lock, 0, __ATOMIC_RELEASE);
      die("out of memory");
    }
  }
  heap_top = end;
  __atomic_store_n(&heap_lock, 0, __ATOMIC_RELEASE);
  return (void *)p;
}
static void *calloc(size_t n, size_t s) {
  /* Fresh memory from memory.grow is zero, but reused memory after heap_reset may not be. */
  void *p = malloc(n * s);
  memset(p, 0, n * s);
  return p;
}


enum { URF, UFL, ULB, UBR, DFR, DLF, DBL, DRB };
enum { UR, UF, UL, UB, DR, DF, DL, DB, FR, FL, BL, BR };

typedef struct {
  uint8_t cp[8], co[8], ep[12], eo[12];
} Cube;

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

/* Changed from cube3.c: conjugates computed on the fly (only for class representatives),
 * not stored for every raw coordinate. The classes, symmetries and order are identical. */
static void build_symcoord(SymCoord *sc, uint32_t nraw, uint32_t (*cj)(uint32_t, int)) {
  sc->nraw = nraw;
  sc->cls = malloc(nraw * sizeof(uint16_t));
  sc->sym = malloc(nraw);
  uint8_t *done = calloc(nraw, 1);
  uint32_t nclass = 0, cap = 1 << 16;
  sc->rep = malloc(cap * sizeof(uint32_t));
  sc->stab = malloc(cap * sizeof(uint16_t));
  for (uint32_t r = 0; r < nraw; r++) {
    if (done[r]) continue;
    if (nclass >= 65535) die("too many symmetry classes for uint16");
    uint16_t st = 0;
    for (int s = 0; s < 16; s++) {
      uint32_t r2 = cj(r, s);
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
      static int dest[18][12], oadd[18][12], ready;
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

/* ------------------------------------------------- tables: build or receive (changed) */

/* Breadth-first search as in cube3.c's build_table, on one thread. The distances are packed into
 * the 4-bit and/or 2-bit arrays (bits: 1 = 4-bit, 2 = 2-bit), which JS then reads out and caches.
 * Returns the deepest distance. BUILD_COUNTS has the count per distance. */
static uint64_t BUILD_COUNTS[32];
static int build_table(Table *T, int which) {
  table_init(T);
  uint64_t n = T->n, filled = 1;
  uint64_t *cnt = BUILD_COUNTS;
  memset(cnt, 0, sizeof BUILD_COUNTS);
  size_t b4 = (size_t)((n + 1) / 2), b2 = (size_t)((n + 3) / 4);
  /* Outputs first, then the scratch distance array on top (never freed: the builder instance is
   * thrown away after building). */
  uint8_t *v4 = which & 1 ? calloc(b4, 1) : 0, *v2 = which & 2 ? calloc(b2, 1) : 0;
  uint8_t *d = malloc(n);
  memset(d, 255, n);
  d[T->goal] = 0;
  cnt[0] = 1;
  int depth = 0;
  uint64_t out[18 * 16];
  for (;; depth++) {
    int backward = cnt[depth] * 2 > n - filled;
    uint64_t c = 0;
    if (!backward) {
      for (uint64_t i = 0; i < n; i++) {
        if (d[i] != depth) continue;
        int k = neighbours(T, i, out);
        for (int j = 0; j < k; j++)
          if (d[out[j]] == 255) d[out[j]] = (uint8_t)(depth + 1), c++;
      }
    } else {
      for (uint64_t i = 0; i < n; i++) {
        if (d[i] != 255) continue;
        int k = neighbours(T, i, out);
        for (int j = 0; j < k; j++)
          if (d[out[j]] == depth) {
            d[i] = (uint8_t)(depth + 1), c++;
            break;
          }
      }
    }
    js_log(T->name, depth + 1, (double)c);
    if (!c) break;
    cnt[depth + 1] = c;
    filled += c;
  }
  if (filled != n) die("table not filled: some entries unreachable");
  if (depth > 15) die("depth over 15 does not fit in 4 bits");
  for (uint64_t i = 0; i < n; i++) {
    if (v4) v4[i >> 1] |= (uint8_t)(d[i] << ((i & 1) * 4));
    if (v2) v2[i >> 2] |= (uint8_t)((d[i] % 3) << ((i & 3) * 2));
  }
  T->v4 = v4, T->v2 = v2;
  return depth;
}

static void load_table(Table *T, int bits) {
  if (!T->n) table_init(T);
  if ((bits == 4 && !T->v4) || (bits == 2 && !T->v2)) die("table not loaded (call table_alloc and fill it first)");
}

/* Floor tokens as in cube3.c's parse_floor (same tokens, same lookup order). */
static void parse_floor(const char *spec, Floor *F) {
  memset(F, 0, sizeof *F);
  size_t sl = strlen(spec);
  if (sl >= sizeof F->name) die("floor spec too long");
  memcpy(F->name, spec, sl + 1);
  char buf[256];
  memcpy(buf, spec, sl + 1);
  int ntok = 0;
  char *next = buf;
  while (next && *next) {
    char *tok = next, *plus = tok;
    while (*plus && *plus != '+') plus++;
    next = *plus ? plus + 1 : 0;
    *plus = 0;
  {
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
    if (*p == 'x') mult = (int)strtol10(p + 1, &p);
    if (*p == 'i') inv = 1, p++;
    if (*p == '@') bits = (int)strtol10(p + 1, &p);
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
    ntok++;
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
    if (*nt == *cap) die("too many split tasks");
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


static void apply(Cube *c, const int *mv, int n) { /* copied */
  Cube t;
  for (int i = 0; i < n; i++) {
    mul(c, &MV[mv[i]], &t);
    *c = t;
  }
}

/* ------------------------------------------------- shared state (T8) */

#include <stdatomic.h>

/* One floor for every worker, set once by the loader. */
static Floor FLOOR;

/* Control block, shared by every worker and read by the page through an Int32Array (ctl_ptr).
 * Field order is the JS layout (bench/shared.js CTL). */
typedef struct {
  volatile int stop;      /* 0: raised by the winner or by a ceiling certificate; every search polls it */
  volatile int ceiling;   /* 1: shortest solution the ceiling worker has found (99: none yet) */
  volatile int bound;     /* 2: the prover's current bound = proven floor (published at round start) */
  volatile int next_task; /* 3: next subtree index of the current split round */
  volatile int nt;        /* 4: number of subtrees in the current split round */
  volatile int winner;    /* 5: 1 once a prover has found a solution */
  volatile int win_len;   /* 6 */
  volatile int ceil_len;  /* 7: length of ceil_path (-1 none) */
  volatile int certified; /* 8: 1 if the ceiling worker raised stop because ceiling <= bound */
  volatile int pad[7];
  volatile int win_path[32];  /* 16.. */
  volatile int ceil_path[32]; /* 48.. */
} Ctl;
static Ctl CTL;

/* Per-worker state (the T5 globals SR, ROOT, ROOTC, ROOTHV), one per worker, allocated by it. */
typedef struct {
  Search S;
  Cube root;
  Coords rootc;
  int roothv[96], nstab, h0;
} Ctx;

/* Subtrees of the current split round: collected once, by one worker, into shared memory. */
#define MAXTASKS 8192
static Task *TASKS;

static void prover_won(const int *path, int len) {
  int z = 0;
  if (__atomic_compare_exchange_n(&CTL.winner, &z, 1, 0, __ATOMIC_SEQ_CST, __ATOMIC_SEQ_CST)) {
    for (int i = 0; i < len; i++) CTL.win_path[i] = path[i];
    __atomic_store_n(&CTL.win_len, len, __ATOMIC_SEQ_CST);
  }
  __atomic_store_n(&CTL.stop, 1, __ATOMIC_SEQ_CST);
}

/* ------------------------------------------------- T6's two-phase ceiling (copied from ceiling.inc)
 * Changes: no pthreads/stdio; the desktop floor DESK is the shared FLOOR (must be C8s+P1x3i); the
 * race's Race struct is the shared control block. */

#define NUDP 40320
#define NSP 24
static const int P2M[10] = {0, 1, 2, 4, 7, 9, 10, 11, 13, 16}; /* U U2 U' R2 F2 D D2 D' L2 B2 */
static uint16_t UDPMove[NUDP][10], CP2Move[NCPERM][10];
static uint8_t SPMove[NSP][10];
static uint8_t *PrunCS, *PrunUS;
static Table *P1T;
#define DESK FLOOR

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
  if (strcmp(FLOOR.name, "C8s+P1x3i")) die("the ceiling needs the desktop floor C8s+P1x3i");
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
  P1T = table_by_name("phase1_sym");
  load_table(P1T, 4);
}

static inline int p1h(int tw, int fl, int sl) {
  uint32_t r = (uint32_t)sl * NFLIP + (uint32_t)fl;
  return get4(P1T, (uint64_t)FlipSliceSym.cls[r] * NTWIST + TwistConj[tw][FlipSliceSym.sym[r]]);
}

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

typedef struct {
  const Cube *x;
  int fullfloor, trace, floor0, stop_at;
  _Atomic int target;
  double t0, deadline;
  uint64_t nodes, next_check, p2calls;
  int stopped;
  int vinv, vaxis, a;
  int p1[32], p2[32];
  int best[32], bestlen;
  int nlog;
  double log_t[32];
  int log_len[32];
  double log_nodes[32];
  volatile int *stop;
  void (*on_found)(void *arg, int len);
  void *arg;
  Cube root;
} Ceil;

static void ceil_check(Ceil *C) {
  C->next_check = C->nodes + 20000;
  if (now() > C->deadline || (C->stop && *C->stop)) C->stopped = 1;
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
    C->log_nodes[C->nlog] = (double)C->nodes;
    C->nlog++;
  }
  if (C->on_found) C->on_found(C->arg, n);
}

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
    if (rem == 1 && (f == 0 || f == 3 || m % 3 == 1)) continue;
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

/* T6's race_found on the shared control block: publish the path, lower the ceiling, and raise the
 * stop flag if the ceiling has met the prover's proven bound (the certificate). seq_cst on both
 * sides (the page stores bound then loads ceiling; this stores ceiling then loads bound). */
static void race_found(void *arg, int len) {
  Ceil *C = arg;
  int c = __atomic_load_n(&CTL.ceiling, __ATOMIC_SEQ_CST);
  if (len >= c) return;
  for (int i = 0; i < len; i++) CTL.ceil_path[i] = C->best[i];
  __atomic_store_n(&CTL.ceil_len, len, __ATOMIC_SEQ_CST);
  __atomic_store_n(&CTL.ceiling, len, __ATOMIC_SEQ_CST); /* only the ceiling worker writes it */
  if (len <= __atomic_load_n(&CTL.bound, __ATOMIC_SEQ_CST)) {
    __atomic_store_n(&CTL.certified, 1, __ATOMIC_SEQ_CST);
    __atomic_store_n(&CTL.stop, 1, __ATOMIC_SEQ_CST);
  }
}

/* ------------------------------------------------------------ JS entry points */

/* Once, by the loader worker, before any other worker runs anything. */
EXPORT(init) void x_init(void) {
  init_cube();
  init_coords();
  init_conjmap();
  CTL.ceiling = 99, CTL.ceil_len = -1;
}
EXPORT(scratch) void *x_scratch(uint32_t n) { return malloc(n); }
EXPORT(heap_top) double x_heap_top(void) { return (double)heap_top; }
EXPORT(ctl_ptr) void *x_ctl_ptr(void) { return (void *)&CTL; }
EXPORT(table_id) int x_table_id(const char *name) {
  for (int i = 0; i < NTABLES; i++)
    if (!strcmp(TABLES[i].name, name)) return i;
  return -1;
}
EXPORT(table_entries) double x_table_entries(int id) {
  table_init(&TABLES[id]);
  return (double)TABLES[id].n;
}
/* Node check only (scratch memory is not freed); the browser builds with T5's builder. */
EXPORT(table_build) int x_table_build(int id, int which) { return build_table(&TABLES[id], which); }
EXPORT(build_count) double x_build_count(int d) { return (double)BUILD_COUNTS[d]; }
EXPORT(table_bytes) double x_table_bytes(int id, int bits) {
  table_init(&TABLES[id]);
  return (double)table_bytes(&TABLES[id], bits);
}
EXPORT(table_ptr) const void *x_table_ptr(int id, int bits) { return bits == 4 ? TABLES[id].v4 : TABLES[id].v2; }
EXPORT(table_alloc) void *x_table_alloc(int id, int bits) {
  Table *T = &TABLES[id];
  table_init(T);
  uint8_t *p = malloc(table_bytes(T, bits));
  if (bits == 4)
    T->v4 = p;
  else
    T->v2 = p;
  return p;
}
EXPORT(floor_set) int x_floor_set(const char *spec) {
  parse_floor(spec, &FLOOR);
  return FLOOR.nl;
}
EXPORT(floor_bytes) double x_floor_bytes(void) { return (double)floor_bytes(&FLOOR, 0); }
EXPORT(floor_aux_bytes) double x_floor_aux_bytes(void) {
  size_t aux;
  floor_bytes(&FLOOR, &aux);
  return (double)aux;
}
EXPORT(ceil_init) void x_ceil_init(void) { ceil_init(); }

EXPORT(ctx_new) Ctx *x_ctx_new(void) { return calloc(1, sizeof(Ctx)); }
EXPORT(root_set) int x_root_set(Ctx *X, const int *mv, int n) {
  X->root = SOLVED;
  apply(&X->root, mv, n);
  memset(&X->S, 0, sizeof X->S);
  X->S.F = &FLOOR;
  X->nstab = root_symmetry(&X->S, &X->root);
  memset(X->roothv, 0, sizeof X->roothv);
  floor_values(&FLOOR, &X->root, X->roothv);
  coords_of(&X->root, &X->rootc);
  int h = 0;
  for (int l = 0; l < FLOOR.nl; l++)
    if (X->roothv[l] > h) h = X->roothv[l];
  return X->h0 = h;
}
EXPORT(root_symmetries) int x_root_symmetries(Ctx *X) { return X->nstab; }
/* Resets the control block for a new solve (the page calls it while every worker is idle). */
EXPORT(ctl_reset) void x_ctl_reset(void) {
  CTL.stop = 0, CTL.ceiling = 99, CTL.bound = 0, CTL.next_task = 0, CTL.nt = 0;
  CTL.winner = 0, CTL.win_len = 0, CTL.ceil_len = -1, CTL.certified = 0;
}
/* One whole bound on this worker; polls the shared stop flag. */
EXPORT(bound_run) int x_bound_run(Ctx *X, int bound, double maxnodes) {
  Search *S = &X->S;
  S->nodes = 0, S->aborted = 0, S->stop = &CTL.stop, S->maxnodes = (uint64_t)maxnodes;
  int ok = dfs(S, &X->root, &X->rootc, 0, bound, -1, X->roothv);
  if (ok) prover_won(S->path, bound);
  return ok;
}
/* One worker collects the round's depth-sd subtrees into shared memory; the others take indices
 * from the shared counter (no message per subtree). */
EXPORT(tasks_collect) int x_tasks_collect(Ctx *X, int bound, int sd) {
  if (!TASKS) TASKS = malloc(sizeof(Task) * MAXTASKS);
  int cap = MAXTASKS, path[8] = {0}, nt = 0;
  Search *S = &X->S;
  S->nodes = 0, S->aborted = 0, S->stop = &CTL.stop;
  collect(S, &X->root, &X->rootc, 0, sd, bound, -1, X->roothv, path, &TASKS, &nt, &cap);
  __atomic_store_n(&CTL.next_task, 0, __ATOMIC_SEQ_CST);
  __atomic_store_n(&CTL.nt, nt, __ATOMIC_SEQ_CST);
  return nt;
}
/* Runs subtrees of the current round until none are left or the stop flag is up. Returns 1 if this
 * worker found the solution; nodes() is this worker's count, tasks_done() its subtree count. */
EXPORT(tasks_run) int x_tasks_run(Ctx *X, int bound, int sd, double maxnodes) {
  Search *S = &X->S;
  uint64_t nodes = 0;
  int aborted = 0, done = 0, nt = __atomic_load_n(&CTL.nt, __ATOMIC_SEQ_CST);
  for (;;) {
    if (__atomic_load_n(&CTL.stop, __ATOMIC_SEQ_CST)) break;
    int t = __atomic_fetch_add(&CTL.next_task, 1, __ATOMIC_SEQ_CST);
    if (t >= nt) break;
    Search T = *S;
    T.nodes = 0, T.aborted = 0, T.stop = &CTL.stop, T.maxnodes = (uint64_t)maxnodes > nodes ? (uint64_t)maxnodes - nodes : 0;
    memcpy(T.path, TASKS[t].path, sizeof TASKS[t].path);
    int ok = dfs(&T, &TASKS[t].c, &TASKS[t].co, sd, bound - sd, TASKS[t].lastf, TASKS[t].hv);
    nodes += T.nodes;
    done++;
    if (ok) {
      memcpy(S->path, T.path, sizeof T.path);
      prover_won(T.path, bound);
      S->nodes = nodes, S->aborted = 0, S->maxnodes = (uint64_t)done;
      return 1;
    }
    if (T.aborted) {
      aborted = 1;
      break;
    }
  }
  S->nodes = nodes, S->aborted = aborted, S->maxnodes = (uint64_t)done;
  return 0;
}
EXPORT(tasks_done) double x_tasks_done(Ctx *X) { return (double)X->S.maxnodes; }
EXPORT(nodes) double x_nodes(Ctx *X) { return (double)X->S.nodes; }
EXPORT(aborted) int x_aborted(Ctx *X) { return X->S.aborted; }
EXPORT(path_ptr) int *x_path_ptr(Ctx *X) { return X->S.path; }
/* Replays n moves of path on this worker's root: 1 if it ends solved. */
EXPORT(path_check) int x_path_check(Ctx *X, const int *path, int n) {
  Cube z = X->root;
  apply(&z, path, n);
  return same(&z, &SOLVED);
}

/* The ceiling worker: T6's trace mode (target 22, lowered after every solution), racing the provers
 * through the control block. Stops on a certificate, when a prover wins, or after cap seconds. */
EXPORT(ceil_new) Ceil *x_ceil_new(void) { return calloc(1, sizeof(Ceil)); }
EXPORT(ceil_run) int x_ceil_run(Ceil *C, const int *mv, int n, double cap, int race) {
  C->root = SOLVED;
  apply(&C->root, mv, n);
  C->stop = &CTL.stop;
  C->on_found = race ? race_found : 0;
  C->arg = C;
  return ceiling_run(C, &C->root, 22, cap, 1, 1);
}
EXPORT(ceil_nodes) double x_ceil_nodes(Ceil *C) { return (double)C->nodes; }
EXPORT(ceil_nlog) int x_ceil_nlog(Ceil *C) { return C->nlog; }
EXPORT(ceil_log_t) double x_ceil_log_t(Ceil *C, int i) { return C->log_t[i]; }
EXPORT(ceil_log_len) int x_ceil_log_len(Ceil *C, int i) { return C->log_len[i]; }
EXPORT(ceil_best) int *x_ceil_best(Ceil *C) { return C->best; }
EXPORT(ceil_bestlen) int x_ceil_bestlen(Ceil *C) { return C->bestlen; }
