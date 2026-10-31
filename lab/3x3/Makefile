CC ?= gcc
CFLAGS ?= -O3 -march=native -fopenmp -Wall -Wextra -std=gnu11

cube3: src/cube3.c
	$(CC) $(CFLAGS) -o $@ $< -lm

clean:
	rm -f cube3
