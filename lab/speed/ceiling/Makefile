CC ?= gcc
CFLAGS ?= -O3 -march=native -fopenmp -Wall -Wextra -std=gnu11

race: src/race.c src/ceiling.inc
	$(CC) $(CFLAGS) -o $@ $< -lm -lpthread

clean:
	rm -f race
