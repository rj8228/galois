CC ?= gcc
CFLAGS ?= -O3 -march=native -fopenmp -Wall -Wextra -std=gnu11

comb: src/comb.c src/gravity.inc src/ceiling.inc src/combined.inc
	$(CC) $(CFLAGS) -o $@ $< -lm -lpthread

clean:
	rm -f comb
