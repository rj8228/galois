CC ?= gcc
CFLAGS ?= -O3 -march=native -fopenmp -Wall -Wextra -std=gnu11

anat3: src/anat3.c src/anatomy.inc
	$(CC) $(CFLAGS) -o $@ $< -lm

clean:
	rm -f anat3
