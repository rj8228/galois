# Builds the WebAssembly solver core (clang 18, no libc) and the native reference from lab/3x3.
CLANG ?= clang
WASMFLAGS = --target=wasm32 -O3 -mbulk-memory -msimd128 -nostdlib -ffreestanding -fno-builtin-malloc \
            -Wall -Wextra -Wno-unknown-pragmas
LDFLAGS = -Wl,--no-entry -Wl,--export-dynamic -Wl,-z,stack-size=8388608 -Wl,--initial-memory=33554432 \
          -Wl,--max-memory=4294967296 -Wl,--allow-undefined-file=src/imports.txt

all: bench/core.wasm build/cube3

bench/core.wasm: src/core.c src/imports.txt
	$(CLANG) $(WASMFLAGS) $(LDFLAGS) -o $@ src/core.c

build/cube3: ../../3x3/src/cube3.c
	mkdir -p build
	gcc -O3 -march=native -fopenmp -Wall -Wextra -std=gnu11 -o $@ $< -lm

clean:
	rm -f bench/core.wasm build/cube3
