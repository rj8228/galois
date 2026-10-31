| corner floor | corner bytes | mean corner floor | full-3×3 nodes, 50 scrambles | vs exact | seconds | frontier |
|---|---:|---:|---:|---:|---:|---|
| no corner floor (the two edge tables alone) | 0 | 0.000 | 66,552,574 | 5.76× | 45 | **yes** |
| perimeter table over symmetry+inverse classes: exact to 5, 6 beyond | 7,401 | 5.997 | 58,662,838 | 5.08× | 44 | **yes** |
| perimeter table over symmetry classes: exact to 5, 6 beyond | 13,570 | 5.997 | 58,662,838 | 5.08× | 44 |  |
| perimeter table over symmetry+inverse classes: exact to 6, 7 beyond | 36,856 | 6.981 | 41,269,162 | 3.57× | 33 | **yes** |
| perimeter table over symmetry classes: exact to 6, 7 beyond | 67,100 | 6.981 | 41,269,162 | 3.57× | 33 |  |
| sym+inv MLP 256-128-64 (100 epochs), int8, margin 2 | 71,750 | 6.229 | 55,199,584 | 4.78× | 168 |  |
| sym MLP 256-128-64 (100 epochs), int8, margin 2 | 76,494 | 6.228 | 55,240,144 | 4.78× | 112 |  |
| sym+inv MLP 256-128-64 (100 epochs), int8, margin 1 | 108,250 | 7.211 | 35,969,262 | 3.11× | 137 | **yes** |
| max of two 4-corner tables | 136,080 | 5.683 | 60,158,770 | 5.21× | 45 |  |
| sym MLP 256-128-64 (100 epochs), int8, margin 1 | 143,413 | 7.209 | 36,003,064 | 3.12× | 90 |  |
| perimeter table over symmetry+inverse classes: exact to 7, 8 beyond | 155,572 | 7.904 | 17,094,941 | 1.48× | 16 | **yes** |
| sym+inv MLP 512-256-128 (100 epochs), int8, margin 2 | 213,966 | 6.292 | 53,840,806 | 4.66× | 196 |  |
| sym MLP 512-256-128 (100 epochs), int8, margin 2 | 214,912 | 6.292 | 53,839,111 | 4.66× | 140 |  |
| sym+inv MLP 512-256-128 (30 epochs), int8, margin 2 | 218,886 | 6.220 | 55,442,233 | 4.80× | 206 |  |
| sym MLP 512-256-128 (30 epochs), int8, margin 2 | 223,641 | 6.219 | 55,459,330 | 4.80× | 154 |  |
| sym+inv MLP 512-256-128 (100 epochs), int8, margin 1 | 236,417 | 7.282 | 34,062,546 | 2.95× | 160 |  |
| sym+inv MLP 512-256-128 (30 epochs), int8, margin 1 | 253,855 | 7.202 | 36,253,530 | 3.14× | 172 |  |
| sym MLP 512-256-128 (100 epochs), int8, margin 1 | 255,448 | 7.283 | 34,075,848 | 2.95× | 112 |  |
| sym+inv MLP 256-128-64 (100 epochs), int8, margin 0 | 284,368 | 8.094 | 15,904,172 | 1.38× | 92 | **yes** |
| perimeter table over symmetry classes: exact to 7, 8 beyond | 285,791 | 7.904 | 17,094,941 | 1.48× | 16 |  |
| sym MLP 512-256-128 (30 epochs), int8, margin 1 | 287,644 | 7.201 | 36,255,934 | 3.14× | 125 |  |
| sym+inv MLP 512-256-128 (30 epochs), int8, margin 0 | 424,312 | 8.089 | 15,903,801 | 1.38× | 114 | **yes** |
| sym+inv MLP 512-256-128 (100 epochs), int8, margin 0 | 428,116 | 8.168 | 15,724,617 | 1.36× | 104 | **yes** |
| symmetry+inverse-reduced table, 2 bits (mod 3) | 438,215 | 8.764 | 11,550,222 | 1.00× | 8 | **yes** |
| perimeter table: exact to distance 5, 6 beyond | 443,535 | 5.997 | 58,662,838 | 5.08× | 44 |  |
| sym MLP 256-128-64 (100 epochs), int8, margin 0 | 466,293 | 8.094 | 15,909,345 | 1.38× | 55 |  |
| sym MLP 512-256-128 (30 epochs), int8, margin 0 | 600,996 | 8.089 | 15,897,281 | 1.38× | 75 |  |
| sym MLP 512-256-128 (100 epochs), int8, margin 0 | 607,205 | 8.169 | 15,731,036 | 1.36× | 67 |  |
| symmetry-reduced table, 2 bits (mod 3) | 618,642 | 8.764 | 11,550,222 | 1.00× | 8 |  |
| raw MLP 512-256-128 (2 epochs), int8, margin 2 | 663,385 | 6.059 | 57,659,407 | 4.99× | 93 |  |
| symmetry+inverse-reduced table, 4 bits | 795,789 | 8.764 | 11,550,222 | 1.00× | 8 |  |
| symmetry-reduced table, 4 bits | 1,156,644 | 8.764 | 11,550,222 | 1.00× | 8 |  |
| max of two 5-corner tables | 1,632,960 | 6.771 | 44,907,070 | 3.89× | 35 |  |
| perimeter table: exact to distance 6, 7 beyond | 2,107,602 | 6.981 | 41,269,162 | 3.57× | 33 |  |
| raw MLP 512-256-128 (2 epochs), int8, margin 1 | 2,503,006 | 7.042 | 39,713,104 | 3.44× | 75 |  |
| perimeter table: exact to distance 7, 8 beyond | 8,509,620 | 7.904 | 17,094,941 | 1.48× | 16 |  |
| raw MLP 512-256-128 (2 epochs), int8, margin 0 | 9,929,777 | 7.953 | 16,714,693 | 1.45× | 40 |  |
| max of two 6-corner tables | 14,696,640 | 7.982 | 18,571,735 | 1.61× | 16 |  |
| 8-corner table, 2 bits (mod 3) | 22,044,960 | 8.764 | 11,550,222 | 1.00× | 8 |  |
| 8-corner table, 4 bits (the truth) | 44,089,920 | 8.764 | 11,550,222 | 1.00× | 8 |  |
