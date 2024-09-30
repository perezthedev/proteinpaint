import type { Genome } from '#types'

export default <Genome>{
	species: 'chicken',
	genomefile: 'genomes/galGal6.gz',
	genedb: {
		dbfile: 'anno/genes.galGal6.db'
	},

	tracks: [
		{
			__isgene: true,
			translatecoding: true,
			file: 'anno/ncbiRefSeq.galGal6.gz',
			type: 'bedj',
			name: 'NCBI RefSeq genes',
			stackheight: 16,
			stackspace: 1,
			vpad: 4,
			color: '#1D591D'
		},
		{
			type: 'bedj',
			name: 'RepeatMasker',
			stackheight: 14,
			file: 'anno/rmsk.galGal6.gz',
			onerow: true,
			categories: {
				SINE: { color: '#ED8C8E', label: 'SINE' },
				LINE: { color: '#EDCB8C', label: 'LINE' },
				LTR: { color: '#E38CED', label: 'LTR' },
				DNA: { color: '#8C8EED', label: 'DNA transposon' },
				simple: { color: '#8EB88C', label: 'Simple repeats' },
				low_complexity: { color: '#ACEBA9', label: 'Low complexity' },
				satellite: { color: '#B59A84', label: 'Satellite' },
				RNA: { color: '#9DE0E0', label: 'RNA repeat' },
				other: { color: '#9BADC2', label: 'Other' },
				unknown: { color: '#858585', label: 'Unknown' }
			}
		}
	],
	defaultcoord: {
		chr: 'chr2',
		start: 32430516,
		stop: 32858004
	},
	majorchr: `
chr1	197608386
chr2	149682049
chr3	110838418
chr4	91315245
chrZ	82529921
chr5	59809098
chr7	36742308
chr6	36374701
chr8	30219446
chr9	24153086
chr10	21119840
chr12	20387278
chr11	20200042
chr13	19166714
chr14	16219308
chr20	13897287
chr15	13062184
chr18	11373140
chr17	10762512
chr19	10323212
chr27	8080432
chr33	7821666
chr21	6844979
chrW	6813114
chr24	6491222
chr31	6153034
chr23	6149580
chr26	6055710
chr22	5459462
chr28	5116882
chr25	3980610
chr16	2844601`,
	minorchr: `

chrUn_NW_020110167v1	2023903
chrUn_NW_020110164v1	2003471
chrUn_NW_020110165v1	1977309
chr30	1818525
chrUn_NW_020110162v1	1222195
chrUn_NW_020110163v1	900507
chr32	725831
chrUn_NW_020110160v1	696307
chrUn_NW_020110161v1	665899
chrUn_NW_020110158v1	468536
chrUn_NW_020110159v1	199634
chrUn_NW_020110156v1	177577
chr16_NW_020109758v1_random	149503
chrUn_NW_020110157v1	94788
chrUn_NW_020110154v1	61939
chrUn_NW_020110155v1	53716
chrUn_NW_020110152v1	52554
chrUn_NW_020110153v1	48347
chrUn_NW_020110150v1	42067
chrUn_NW_020110151v1	39545
chrUn_NW_020110148v1	34471
chrUn_NW_020110149v1	34291
chrUn_NW_020109843v1	33802
chrUn_NW_020109841v1	33731
chrUn_NW_020109842v1	33531
chrUn_NW_020109840v1	33083
chrUn_NW_020109839v1	33030
chrUn_NW_020109838v1	30818
chrUn_NW_020109837v1	30439
chrUn_NW_020109836v1	30225
chrUn_NW_020109835v1	30157
chrUn_NW_020109834v1	29697
chrUn_NW_020109833v1	28243
chrW_NW_020109826v1_random	28212
chr9_NW_020109754v1_random	27963
chrUn_NW_020109832v1	27830
chrW_NW_020109825v1_random	27808
chrUn_NW_020109831v1	27130
chrUn_NW_020109830v1	27104
chrUn_NW_020110147v1	26960
chrUn_NW_020110145v1	26595
chrUn_NW_020110146v1	26310
chrUn_NW_020110143v1	26298
chrUn_NW_020110144v1	26150
chrUn_NW_020110141v1	26131
chrUn_NW_020110142v1	25700
chrUn_NW_020110139v1	25466
chrUn_NW_020110140v1	25409
chrUn_NW_020110137v1	25301
chrUn_NW_020110138v1	24712
chrUn_NW_020110135v1	24315
chrUn_NW_020110136v1	24179
chrW_NW_020109824v1_random	24105
chrUn_NW_020110133v1	23907
chrUn_NW_020110134v1	23766
chrUn_NW_020110131v1	23748
chrW_NW_020109823v1_random	23209
chrUn_NW_020110132v1	23190
chrUn_NW_020110129v1	22982
chrW_NW_020109822v1_random	22964
chrUn_NW_020110130v1	22641
chrUn_NW_020110127v1	22621
chrUn_NW_020110128v1	22381
chrUn_NW_020110125v1	22379
chr1_NW_020109743v1_random	22289
chrUn_NW_020110126v1	21751
chrUn_NW_020110123v1	21699
chrUn_NW_020110124v1	21677
chrUn_NW_020110121v1	21586
chrUn_NW_020110122v1	21580
chr1_NW_020109742v1_random	21511
chrUn_NW_020110119v1	21427
chrUn_NW_020110120v1	21266
chrUn_NW_020110117v1	20717
chrUn_NW_020110118v1	20496
chrUn_NW_020110115v1	20494
chrUn_NW_020110116v1	20270
chrW_NW_020109821v1_random	19928
chrUn_NW_020110113v1	19903
chrW_NW_020109820v1_random	19850
chrW_NW_020109819v1_random	19721
chrUn_NW_020110114v1	19536
chrW_NW_020109818v1_random	19471
chrW_NW_020109817v1_random	19204
chrUn_NW_020110111v1	19095
chrW_NW_020109816v1_random	19032
chrUn_NW_020110112v1	18989
chr23_NW_020109766v1_random	18922
chr6_NW_020109753v1_random	18845
chrUn_NW_020110109v1	18705
chrUn_NW_020110110v1	18507
chrUn_NW_020110107v1	18412
chrUn_NW_020110108v1	18344
chrUn_NW_020110105v1	18101
chrUn_NW_020110106v1	18034
chrW_NW_020109815v1_random	18028
chrW_NW_020109814v1_random	17442
chrUn_NW_020110103v1	17402
chrW_NW_020109813v1_random	17321
chrUn_NW_020110104v1	17237
chrW_NW_020109812v1_random	17224
chrW_NW_020109811v1_random	17217
chrUn_NW_020110101v1	17007
chrM	16775
chrUn_NW_020110102v1	16505
chrUn_NW_020110099v1	16464
chrW_NW_020109810v1_random	16320
chrUn_NW_020110100v1	16245
chrUn_NW_020110097v1	16233
chr23_NW_020109765v1_random	16157
chrUn_NW_020110098v1	16140
chrUn_NW_020110095v1	16129
chrUn_NW_020110096v1	16106
chrW_NW_020109809v1_random	16043
chrUn_NW_020110093v1	16031
chrUn_NW_020110094v1	15929
chrUn_NW_020110091v1	15680
chrUn_NW_020110092v1	15663
chrUn_NW_020110089v1	15638
chrZ_NW_020109829v1_random	15587
chrUn_NW_020110090v1	15492
chrW_NW_020109808v1_random	15438
chrUn_NW_020110087v1	15417
chrUn_NW_020110088v1	15387
chrUn_NW_020110085v1	15167
chrUn_NW_020110086v1	15134
chrUn_NW_020110083v1	15132
chrUn_NW_020110084v1	15049
chr23_NW_020109764v1_random	15003
chrW_NW_020109807v1_random	14810
chrUn_NW_020110081v1	14773
chrUn_NW_020110082v1	14715
chrUn_NW_020110079v1	14655
chrUn_NW_020110080v1	14613
chrUn_NW_020110077v1	14604
chrUn_NW_020110078v1	14494
chrW_NW_020109806v1_random	14330
chrUn_NW_020110075v1	14298
chrUn_NW_020110076v1	14205
chrUn_NW_020110073v1	14131
chrUn_NW_020110074v1	14086
chrW_NW_020109805v1_random	14047
chrUn_NW_020110071v1	13985
chrUn_NW_020110072v1	13913
chrW_NW_020109804v1_random	13829
chrUn_NW_020110069v1	13798
chrUn_NW_020110070v1	13793
chrW_NW_020109803v1_random	13691
chrUn_NW_020110067v1	13671
chrUn_NW_020110068v1	13599
chrUn_NW_020110065v1	13513
chrUn_NW_020110066v1	13240
chrUn_NW_020110063v1	13224
chrUn_NW_020110064v1	13157
chrUn_NW_020110061v1	13139
chrUn_NW_020110062v1	13021
chrUn_NW_020110059v1	12987
chrUn_NW_020110060v1	12986
chrUn_NW_020110057v1	12789
chrW_NW_020109802v1_random	12728
chrUn_NW_020110058v1	12721
chrUn_NW_020110055v1	12562
chrUn_NW_020110056v1	12537
chrUn_NW_020110053v1	12430
chrUn_NW_020110054v1	12389
chrUn_NW_020110051v1	12152
chrUn_NW_020110052v1	12129
chrW_NW_020109801v1_random	12127
chrUn_NW_020110049v1	12125
chrUn_NW_020110050v1	12040
chrUn_NW_020110047v1	11985
chrUn_NW_020110048v1	11970
chrUn_NW_020110045v1	11891
chrUn_NW_020110046v1	11743
chrUn_NW_020110043v1	11663
chrUn_NW_020110044v1	11473
chrUn_NW_020110041v1	11376
chr31_NW_020109771v1_random	11340
chr31_NW_020109770v1_random	11305
chrUn_NW_020110042v1	11254
chrUn_NW_020110039v1	11212
chrUn_NW_020110040v1	11204
chrW_NW_020109800v1_random	11068
chrUn_NW_020110037v1	11066
chrUn_NW_020110038v1	10993
chrUn_NW_020110035v1	10984
chr6_NW_020109752v1_random	10928
chrW_NW_020109799v1_random	10871
chr1_NW_020109741v1_random	10869
chrUn_NW_020110036v1	10816
chr6_NW_020109751v1_random	10724
chrUn_NW_020110033v1	10691
chrW_NW_020109798v1_random	10551
chrUn_NW_020110034v1	10473
chrUn_NW_020110031v1	10371
chrW_NW_020109797v1_random	10371
chrW_NW_020109796v1_random	10224
chrW_NW_020109795v1_random	10162
chrW_NW_020109794v1_random	10106
chrUn_NW_020110032v1	10066
chrUn_NW_020110029v1	10056
chrUn_NW_020110030v1	10010
chrUn_NW_020110027v1	9935
chrUn_NW_020110028v1	9888
chrUn_NW_020110025v1	9858
chrUn_NW_020110026v1	9696
chrUn_NW_020110023v1	9688
chrUn_NW_020110024v1	9619
chrUn_NW_020110021v1	9617
chrW_NW_020109793v1_random	9607
chrUn_NW_020110022v1	9579
chrUn_NW_020110019v1	9568
chr31_NW_020109769v1_random	9481
chrUn_NW_020110020v1	9469
chrUn_NW_020110017v1	9308
chrW_NW_020109792v1_random	9182
chrUn_NW_020110018v1	9172
chrUn_NW_020110015v1	9118
chrW_NW_020109791v1_random	9034
chrUn_NW_020110016v1	9032
chrUn_NW_020110013v1	8999
chrUn_NW_020110014v1	8915
chrUn_NW_020110011v1	8913
chrW_NW_020109790v1_random	8909
chrUn_NW_020110012v1	8891
chrUn_NW_020110009v1	8846
chrUn_NW_020110010v1	8788
chrUn_NW_020110007v1	8749
chrUn_NW_020110008v1	8722
chrUn_NW_020110005v1	8656
chrUn_NW_020110006v1	8637
chrW_NW_020109789v1_random	8559
chrUn_NW_020110003v1	8516
chrUn_NW_020110004v1	8464
chrUn_NW_020110001v1	8294
chrW_NW_020109788v1_random	8275
chrW_NW_020109787v1_random	8267
chrUn_NW_020110002v1	8247
chrUn_NW_020109999v1	8242
chrUn_NW_020110000v1	8189
chrUn_NW_020109997v1	8180
chrW_NW_020109786v1_random	8166
chrUn_NW_020109998v1	8152
chrUn_NW_020109995v1	8118
chrUn_NW_020109996v1	8110
chrUn_NW_020109993v1	8038
chrUn_NW_020109994v1	8025
chrUn_NW_020109991v1	7923
chrUn_NW_020109992v1	7918
chrW_NW_020109785v1_random	7878
chrW_NW_020109784v1_random	7765
chrUn_NW_020109989v1	7675
chrUn_NW_020109990v1	7655
chrUn_NW_020109987v1	7621
chrUn_NW_020109988v1	7511
chrUn_NW_020110168v1	7419
chrUn_NW_020109985v1	7336
chrUn_NW_020109986v1	7298
chr3_NW_020109747v1_random	7246
chrUn_NW_020109983v1	7090
chrW_NW_020109783v1_random	7074
chrUn_NW_020109984v1	6958
chrW_NW_020109782v1_random	6929
chrUn_NW_020109981v1	6925
chrUn_NW_020109982v1	6885
chrUn_NW_020109979v1	6881
chrW_NW_020109781v1_random	6830
chrUn_NW_020109977v1	6824
chrUn_NW_020109980v1	6824
chrUn_NW_020109978v1	6814
chrUn_NW_020109975v1	6808
chrUn_NW_020109976v1	6764
chrUn_NW_020109973v1	6698
chrW_NW_020109780v1_random	6668
chrUn_NW_020109974v1	6638
chrUn_NW_020109971v1	6586
chrUn_NW_020109972v1	6564
chrUn_NW_020109969v1	6539
chrUn_NW_020109970v1	6414
chrUn_NW_020109967v1	6378
chrUn_NW_020109968v1	6349
chrUn_NW_020109965v1	6324
chrUn_NW_020109966v1	6318
chr3_NW_020109746v1_random	6272
chrUn_NW_020109963v1	6269
chrUn_NW_020109964v1	6243
chrUn_NW_020109961v1	6185
chrUn_NW_020109962v1	6066
chrUn_NW_020109959v1	6042
chrUn_NW_020109960v1	5955
chr1_NW_020109740v1_random	5861
chrUn_NW_020109957v1	5791
chrUn_NW_020109958v1	5694
chrUn_NW_020109955v1	5685
chrUn_NW_020109956v1	5662
chrUn_NW_020109953v1	5637
chrW_NW_020109779v1_random	5587
chrUn_NW_020109954v1	5521
chrUn_NW_020109951v1	5419
chrUn_NW_020109952v1	5289
chrUn_NW_020109949v1	5230
chr6_NW_020109750v1_random	5224
chrUn_NW_020109950v1	5199
chrUn_NW_020109947v1	5075
chrUn_NW_020109948v1	5044
chrUn_NW_020110169v1	4840
chrUn_NW_020109945v1	4808
chrUn_NW_020109946v1	4777
chrUn_NW_020109943v1	4766
chrUn_NW_020109944v1	4730
chrUn_NW_020109941v1	4685
chr1_NW_020109739v1_random	4675
chrUn_NW_020109942v1	4652
chrUn_NW_020109939v1	4621
chrUn_NW_020109940v1	4617
chrUn_NW_020109937v1	4511
chrUn_NW_020109938v1	4451
chr6_NW_020109749v1_random	4448
chrUn_NW_020110166v1	4360
chrUn_NW_020109935v1	4359
chrUn_NW_020109936v1	4266
chrUn_NW_020109933v1	4245
chrUn_NW_020109934v1	4206
chrUn_NW_020109931v1	4198
chrUn_NW_020109932v1	4154
chr6_NW_020109748v1_random	4087
chrUn_NW_020109929v1	4040
chrUn_NW_020109930v1	4037
chrUn_NW_020109927v1	3973
chrUn_NW_020109928v1	3863
chrUn_NW_020109925v1	3847
chrUn_NW_020109926v1	3687
chrUn_NW_020109923v1	3680
chrUn_NW_020109924v1	3660
chrUn_NW_020109921v1	3657
chrUn_NW_020109922v1	3647
chrUn_NW_020109919v1	3584
chrUn_NW_020109920v1	3581
chrUn_NW_020109917v1	3531
chrUn_NW_020109918v1	3516
chrUn_NW_020109915v1	3504
chrUn_NW_020109916v1	3436
chrUn_NW_020109913v1	3346
chrW_NW_020109778v1_random	3094
chrUn_NW_020109914v1	3019
chrUn_NW_020109911v1	2991
chrUn_NW_020109912v1	2985
chrUn_NW_020109909v1	2979
chrUn_NW_020109910v1	2948
chrUn_NW_020109907v1	2928
chrUn_NW_020109908v1	2902
chrUn_NW_020109905v1	2898
chrUn_NW_020109906v1	2883
chrUn_NW_020109903v1	2758
chrUn_NW_020109904v1	2663
chrUn_NW_020109901v1	2615
chrUn_NW_020109902v1	2610
chrUn_NW_020109899v1	2599
chrUn_NW_020109900v1	2568
chrUn_NW_020109897v1	2566
chrUn_NW_020109898v1	2555
chrUn_NW_020109895v1	2520
chrUn_NW_020109896v1	2481
chrUn_NW_020109893v1	2462
chrUn_NW_020109894v1	2402
chr1_NW_020109738v1_random	2384
chrUn_NW_020109891v1	2308
chrUn_NW_020109892v1	2262
chrUn_NW_020109889v1	2260
chrUn_NW_020109890v1	2214
chr13_NW_020109755v1_random	2157
chrUn_NW_020109887v1	2149
chrW_NW_020109777v1_random	2092
chrUn_NW_020109888v1	2087
chrUn_NW_020109885v1	2071
chr15_NW_020109757v1_random	2034
chrUn_NW_020109886v1	2033
chrW_NW_020109776v1_random	2003
chrUn_NW_020109883v1	1935
chrUn_NW_020109884v1	1908
chr25_NW_020109767v1_random	1884
chrUn_NW_020109881v1	1840
chrUn_NW_020109882v1	1834
chrUn_NW_020109879v1	1800
chr3_NW_020109745v1_random	1783
chrUn_NW_020109880v1	1782
chr1_NW_020109737v1_random	1765
chrUn_NW_020109877v1	1756
chrUn_NW_020109878v1	1752
chrUn_NW_020109875v1	1748
chrUn_NW_020109876v1	1664
chr23_NW_020109763v1_random	1662
chrUn_NW_020109873v1	1643
chrUn_NW_020109874v1	1589
chrUn_NW_020109871v1	1579
chrW_NW_020109775v1_random	1568
chrUn_NW_020109872v1	1547
chr28_NW_020109768v1_random	1519
chrUn_NW_020109869v1	1453
chrUn_NW_020109870v1	1394
chrUn_NW_020109867v1	1381
chrUn_NW_020109868v1	1367
chr23_NW_020109762v1_random	1264
chrUn_NW_020109865v1	1173
chrUn_NW_020109866v1	1167
chr19_NW_020109759v1_random	1131
chrUn_NW_020109863v1	1115
chrUn_NW_020109864v1	1086
chrUn_NW_020109861v1	966
chrUn_NW_020109862v1	955
chrUn_NW_020109859v1	950
chr22_NW_020109760v1_random	918
chrUn_NW_020109860v1	848
chrUn_NW_020109857v1	806
chrUn_NW_020109858v1	791
chr14_NW_020109756v1_random	765
chrUn_NW_020109855v1	678
chrUn_NW_020109856v1	677
chrUn_NW_020109853v1	676
chrUn_NW_020109854v1	644
chrUn_NW_020109851v1	623
chrUn_NW_020109852v1	597
chrUn_NW_020109849v1	579
chrUn_NW_020109850v1	555
chr3_NW_020109744v1_random	509
chrUn_NW_020109847v1	345
chrUn_NW_020109848v1	342
chr23_NW_020109761v1_random	322
chrUn_NW_020109845v1	246
chrUn_NW_020109846v1	195
chr33_NW_020109772v1_random	182
chrUn_NW_020109844v1	87`
}
