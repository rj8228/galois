| floor | bytes (net: weights + corrections) | vs 44 MB | mean floor | exact | IDA* nodes, 50 scrambles | cheapest plain table as strong | smaller than it? |
|---|---:|---:|---:|---:|---:|---|---|
| 8-corner table, 4 bits (the truth) | 44,089,920 | 1× | 8.764 | 100.0% | 2,209 |  |  |
| 8-corner table, 2 bits (mod 3) | 22,044,960 | 2× | 8.764 | 100.0% | 2,209 |  |  |
| max of two 6-corner tables | 14,696,640 | 3× | 7.982 | 43.1% | 9,382 |  |  |
| perimeter table: exact to distance 7, 8 beyond | 8,509,620 | 5× | 7.904 | 31.3% | 2,947 |  |  |
| 6-corner table | 7,348,320 | 6× | 7.610 | 31.0% | 692,270 |  |  |
| perimeter table: exact to distance 6, 7 beyond | 2,107,602 | 21× | 6.981 | 7.7% | 13,996 |  |  |
| max of two 5-corner tables | 1,632,960 | 27× | 6.771 | 7.1% | 117,427 |  |  |
| symmetry-reduced table, 4 bits | 1,156,644 | 38× | 8.764 | 100.0% | 2,209 |  |  |
| 5-corner table | 816,480 | 54× | 6.365 | 4.7% | 3,573,994 |  |  |
| symmetry+inverse-reduced table, 4 bits | 795,789 | 55× | 8.764 | 100.0% | 2,209 |  |  |
| symmetry-reduced table, 2 bits (mod 3) | 618,642 | 71× | 8.764 | 100.0% | 2,209 |  |  |
| perimeter table: exact to distance 5, 6 beyond | 443,535 | 99× | 5.997 | 1.6% | 163,943 |  |  |
| symmetry+inverse-reduced table, 2 bits (mod 3) | 438,215 | 101× | 8.764 | 100.0% | 2,209 |  |  |
| perimeter table over symmetry+inverse classes (exact to 7) + 1 bit per entry (9 if distance ≥ 9, else 8) | 415,000 | 106× | 8.591 | 82.8% | 2,209 |  |  |
| perimeter table over symmetry+inverse classes (exact to 6) + 1 bit per entry (9 if distance ≥ 9, else 7) | 296,284 | 149× | 8.355 | 59.2% | 2,887 |  |  |
| perimeter table over symmetry classes: exact to 7, 8 beyond | 285,791 | 154× | 7.904 | 31.3% | 2,947 |  |  |
| perimeter table over symmetry+inverse classes (exact to 5) + 1 bit per entry (9 if distance ≥ 9, else 6) | 266,829 | 165× | 8.058 | 53.1% | 10,037 |  |  |
| perimeter table over symmetry+inverse classes: exact to 7, 8 beyond | 155,572 | 283× | 7.904 | 31.3% | 2,947 |  |  |
| max of two 4-corner tables | 136,080 | 324× | 5.683 | 0.8% | 1,417,867 |  |  |
| 4-corner table | 68,040 | 648× | 5.292 | 0.5% | 30,730,621 |  |  |
| perimeter table over symmetry classes: exact to 6, 7 beyond | 67,100 | 657× | 6.981 | 7.7% | 13,996 |  |  |
| perimeter table over symmetry+inverse classes: exact to 6, 7 beyond | 36,856 | 1196× | 6.981 | 7.7% | 13,996 |  |  |
| perimeter table over symmetry classes: exact to 5, 6 beyond | 13,570 | 3249× | 5.997 | 1.6% | 163,943 |  |  |
| perimeter table over symmetry+inverse classes: exact to 5, 6 beyond | 7,401 | 5957× | 5.997 | 1.6% | 163,943 |  |  |
| 3-corner table | 4,536 | 9720× | 4.078 | 0.0% | 358,853,434 |  |  |
| raw MLP 512-256-128 (2 epochs), fp16, margin 0 | 10,114,057 (419,842 + 9,694,215) | 4× | 7.953 | 34.7% | 2,898 | perimeter table over symmetry+inverse classes (exact to 6) + 1 bit per entry (9 if distance ≥ 9, else 7) (296,284) | no |
| raw MLP 512-256-128 (2 epochs), fp16, margin 1 | 2,705,875 (419,842 + 2,286,033) | 16× | 7.041 | 8.8% | 13,395 | perimeter table over symmetry+inverse classes: exact to 7, 8 beyond (155,572) | no |
| raw MLP 512-256-128 (2 epochs), fp16, margin 2 | 870,254 (419,842 + 450,412) | 51× | 6.058 | 1.7% | 156,091 | perimeter table over symmetry+inverse classes: exact to 6, 7 beyond (36,856) | no |
| raw MLP 512-256-128 (2 epochs), int8, margin 0 | 9,929,777 (212,612 + 9,717,165) | 4× | 7.953 | 34.8% | 2,898 | perimeter table over symmetry+inverse classes (exact to 6) + 1 bit per entry (9 if distance ≥ 9, else 7) (296,284) | no |
| raw MLP 512-256-128 (2 epochs), int8, margin 1 | 2,503,006 (212,612 + 2,290,394) | 18× | 7.042 | 8.8% | 13,383 | perimeter table over symmetry+inverse classes: exact to 7, 8 beyond (155,572) | no |
| raw MLP 512-256-128 (2 epochs), int8, margin 2 | 663,385 (212,612 + 450,773) | 66× | 6.059 | 1.7% | 155,842 | perimeter table over symmetry+inverse classes: exact to 6, 7 beyond (36,856) | no |
| sym MLP 512-256-128 (30 epochs), fp16, margin 0 | 809,347 (419,842 + 389,505) | 54× | 8.091 | 44.6% | 2,881 | perimeter table over symmetry+inverse classes (exact to 7) + 1 bit per entry (9 if distance ≥ 9, else 8) (415,000) | no |
| sym MLP 512-256-128 (30 epochs), fp16, margin 1 | 494,952 (419,842 + 75,110) | 89× | 7.203 | 11.2% | 13,472 | perimeter table over symmetry+inverse classes: exact to 7, 8 beyond (155,572) | no |
| sym MLP 512-256-128 (30 epochs), fp16, margin 2 | 430,881 (419,842 + 11,039) | 102× | 6.221 | 1.8% | 153,817 | perimeter table over symmetry+inverse classes: exact to 6, 7 beyond (36,856) | no |
| sym MLP 512-256-128 (30 epochs), int8, margin 0 | 600,996 (212,612 + 388,384) | 73× | 8.089 | 44.5% | 2,878 | perimeter table over symmetry+inverse classes (exact to 7) + 1 bit per entry (9 if distance ≥ 9, else 8) (415,000) | no |
| sym MLP 512-256-128 (30 epochs), int8, margin 1 | 287,644 (212,612 + 75,032) | 153× | 7.201 | 11.2% | 13,562 | perimeter table over symmetry+inverse classes: exact to 7, 8 beyond (155,572) | no |
| sym MLP 512-256-128 (30 epochs), int8, margin 2 | 223,641 (212,612 + 11,029) | 197× | 6.219 | 1.8% | 154,381 | perimeter table over symmetry+inverse classes: exact to 6, 7 beyond (36,856) | no |
| sym MLP 512-256-128 (100 epochs), fp16, margin 0 | 822,840 (419,842 + 402,998) | 54× | 8.177 | 51.4% | 3,139 | perimeter table over symmetry+inverse classes (exact to 6) + 1 bit per entry (9 if distance ≥ 9, else 7) (296,284) | no |
| sym MLP 512-256-128 (100 epochs), fp16, margin 1 | 463,452 (419,842 + 43,610) | 95× | 7.294 | 11.6% | 19,707 | perimeter table over symmetry+inverse classes: exact to 7, 8 beyond (155,572) | no |
| sym MLP 512-256-128 (100 epochs), fp16, margin 2 | 422,152 (419,842 + 2,310) | 104× | 6.304 | 1.0% | 284,971 | perimeter table over symmetry+inverse classes: exact to 6, 7 beyond (36,856) | no |
| sym MLP 512-256-128 (100 epochs), int8, margin 0 | 607,205 (212,612 + 394,593) | 73× | 8.169 | 50.8% | 3,166 | perimeter table over symmetry+inverse classes (exact to 6) + 1 bit per entry (9 if distance ≥ 9, else 7) (296,284) | no |
| sym MLP 512-256-128 (100 epochs), int8, margin 1 | 255,448 (212,612 + 42,836) | 173× | 7.283 | 11.4% | 19,904 | perimeter table over symmetry+inverse classes: exact to 7, 8 beyond (155,572) | no |
| sym MLP 512-256-128 (100 epochs), int8, margin 2 | 214,912 (212,612 + 2,300) | 205× | 6.292 | 1.0% | 279,438 | perimeter table over symmetry+inverse classes: exact to 6, 7 beyond (36,856) | no |
| sym MLP 256-128-64 (100 epochs), fp16, margin 0 | 525,484 (128,002 + 397,482) | 84× | 8.090 | 44.7% | 2,919 | perimeter table over symmetry+inverse classes (exact to 6) + 1 bit per entry (9 if distance ≥ 9, else 7) (296,284) | no |
| sym MLP 256-128-64 (100 epochs), fp16, margin 1 | 205,366 (128,002 + 77,364) | 215× | 7.205 | 11.5% | 13,929 | perimeter table over symmetry+inverse classes: exact to 7, 8 beyond (155,572) | no |
| sym MLP 256-128-64 (100 epochs), fp16, margin 2 | 139,109 (128,002 + 11,107) | 317× | 6.224 | 1.8% | 161,147 | perimeter table over symmetry+inverse classes: exact to 6, 7 beyond (36,856) | no |
| sym MLP 256-128-64 (100 epochs), int8, margin 0 | 466,293 (65,348 + 400,945) | 95× | 8.094 | 45.0% | 2,934 | perimeter table over symmetry+inverse classes (exact to 6) + 1 bit per entry (9 if distance ≥ 9, else 7) (296,284) | no |
| sym MLP 256-128-64 (100 epochs), int8, margin 1 | 143,413 (65,348 + 78,065) | 307× | 7.209 | 11.6% | 13,920 | perimeter table over symmetry+inverse classes: exact to 7, 8 beyond (155,572) | yes |
| sym MLP 256-128-64 (100 epochs), int8, margin 2 | 76,494 (65,348 + 11,146) | 576× | 6.228 | 1.9% | 160,022 | perimeter table over symmetry+inverse classes: exact to 6, 7 beyond (36,856) | no |
| sym+inv MLP 512-256-128 (30 epochs), int8, margin 0 | 424,312 (212,612 + 211,700) | 104× | 8.089 | 44.5% | 2,840 | perimeter table over symmetry+inverse classes (exact to 7) + 1 bit per entry (9 if distance ≥ 9, else 8) (415,000) | no |
| sym+inv MLP 512-256-128 (30 epochs), int8, margin 1 | 253,855 (212,612 + 41,243) | 174× | 7.202 | 11.2% | 13,313 | perimeter table over symmetry+inverse classes: exact to 7, 8 beyond (155,572) | no |
| sym+inv MLP 512-256-128 (30 epochs), int8, margin 2 | 218,886 (212,612 + 6,274) | 201× | 6.220 | 1.8% | 153,747 | perimeter table over symmetry+inverse classes: exact to 6, 7 beyond (36,856) | no |
| sym+inv MLP 512-256-128 (100 epochs), int8, margin 0 | 428,116 (212,612 + 215,504) | 103× | 8.168 | 50.7% | 3,220 | perimeter table over symmetry+inverse classes (exact to 6) + 1 bit per entry (9 if distance ≥ 9, else 7) (296,284) | no |
| sym+inv MLP 512-256-128 (100 epochs), int8, margin 1 | 236,417 (212,612 + 23,805) | 186× | 7.282 | 11.5% | 19,392 | perimeter table over symmetry+inverse classes: exact to 7, 8 beyond (155,572) | no |
| sym+inv MLP 512-256-128 (100 epochs), int8, margin 2 | 213,966 (212,612 + 1,354) | 206× | 6.292 | 1.0% | 279,798 | perimeter table over symmetry+inverse classes: exact to 6, 7 beyond (36,856) | no |
| sym+inv MLP 256-128-64 (100 epochs), int8, margin 0 | 284,368 (65,348 + 219,020) | 155× | 8.094 | 45.0% | 2,918 | perimeter table over symmetry+inverse classes (exact to 6) + 1 bit per entry (9 if distance ≥ 9, else 7) (296,284) | yes |
| sym+inv MLP 256-128-64 (100 epochs), int8, margin 1 | 108,250 (65,348 + 42,902) | 407× | 7.211 | 11.6% | 13,894 | perimeter table over symmetry+inverse classes: exact to 7, 8 beyond (155,572) | yes |
| sym+inv MLP 256-128-64 (100 epochs), int8, margin 2 | 71,750 (65,348 + 6,402) | 614× | 6.229 | 1.9% | 160,344 | perimeter table over symmetry+inverse classes: exact to 6, 7 beyond (36,856) | no |
