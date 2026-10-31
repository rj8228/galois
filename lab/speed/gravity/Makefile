CC ?= gcc
CFLAGS ?= -O3 -march=native -fopenmp -Wall -Wextra -std=gnu11

grav3: src/grav3.c src/gravity.inc
	$(CC) $(CFLAGS) -o $@ $< -lm

clean:
	rm -f grav3
