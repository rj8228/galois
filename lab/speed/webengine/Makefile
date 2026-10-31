# T8: the threads build of the solver core (one shared wasm memory for every worker) and the native
# references. bench/core-t5.wasm is T5's copy-per-worker build, committed unchanged (fallback mode
# and the table builder).
CLANG ?= clang
WASMFLAGS = --target=wasm32 -O3 -matomics -mbulk-memory -msimd128 -nostdlib -ffreestanding -fno-builtin-malloc \
            -Wall -Wextra -Wno-unknown-pragmas
# Shared memory: imported (the page creates it), max 2 GiB; every instance gets its own stack, set by
# JS through the exported __stack_pointer before it runs anything.
LDFLAGS = -Wl,--no-entry -Wl,--export-dynamic -Wl,-z,stack-size=2097152 -Wl,--import-memory -Wl,--shared-memory \
          -Wl,--initial-memory=33554432 -Wl,--max-memory=2147483648 -Wl,--export=__stack_pointer \
          -Wl,--export=__heap_base -Wl,--allow-undefined-file=src/imports.txt

all: bench/core-shared.wasm build/cube3 build/race

bench/core-shared.wasm: src/core.c src/imports.txt
	$(CLANG) $(WASMFLAGS) $(LDFLAGS) -o $@ src/core.c

build/cube3: ../../3x3/src/cube3.c
	mkdir -p build
	gcc -O3 -march=native -fopenmp -Wall -Wextra -std=gnu11 -o $@ $< -lm

build/race: ../ceiling/src/race.c ../ceiling/src/ceiling.inc
	mkdir -p build
	gcc -O3 -march=native -fopenmp -pthread -Wall -Wextra -std=gnu11 -o $@ $< -lm

clean:
	rm -f bench/core-shared.wasm build/cube3 build/race
