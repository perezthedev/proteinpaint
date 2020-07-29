module.exports = {
	species: 'human',
	genomefile: 'genomes/hg38.gz',
	genedb: {
		dbfile: 'anno/genes.hg38.db',
		hasalias: true
	},
	proteindomain: {
		dbfile: 'anno/db/proteindomain.db',
		statement: 'select data from domain where isoform=? collate nocase'
	},
	snp: {
		dbfile: 'anno/db/snp146.hg38.db',
		statement_getbyname: 'select * from snp146 where name=?',
		statement_getbycoord: 'select * from snp146 where chrom=? and bin=? and chromStart>=? and chromEnd<=?'
	},
	fimo_motif: {
		db: 'utils/meme/motif_databases/HUMAN/HOCOMOCOv11_full_HUMAN_mono_meme_format.meme',
		annotationfile: 'utils/meme/motif_databases/HUMAN/HOCOMOCOv11_full_annotation_HUMAN_mono.tsv'
	},
	clinvarVCF: {
		file: 'hg38/clinvar.hg38.vcf.gz',
		infokey: 'CLNSIG',
		categories: {
			Uncertain_significance: { color: '#aaa', label: 'Uncertain significance', textcolor: 'white' },
			not_provided: { color: '#ccc', label: 'Not provided' },
			_not_provided: { color: '#ccc', label: 'Not provided' },
			Benign: { color: '#43ac6a', label: 'Benign', textcolor: 'white' },
			'Benign/Likely_benign': { color: '#43ac6a', label: 'Benign/Likely benign', textcolor: 'white' },
			Likely_benign: { color: '#5bc0de', label: 'Likely benign', textcolor: 'white' },
			Likely_pathogenic: { color: '#e99002', label: 'Likely pathogenic', textcolor: 'white' },
			Pathogenic: { color: '#f04124', label: 'Pathogenic', textcolor: 'white' },
			'Pathogenic/Likely_pathogenic': { color: '#f04124', label: 'Pathogenic/Likely pathogenic', textcolor: 'white' },
			drug_response: { color: 'gold', label: 'Drug response', textcolor: 'white' },
			_drug_response: { color: 'gold', label: 'Drug response', textcolor: 'white' },
			Conflicting_interpretations_of_pathogenicity: {
				color: '#90C3D4',
				label: 'Conflicting interpretations of pathogenicity'
			},
			other: { color: '#ccc', label: 'Other' },
			_other: { color: '#ccc', label: 'Other' },
			not_provided: { color: '#ccc', label: 'Not provided' },
			_not_provided: { color: '#ccc', label: 'Not provided' },
			risk_factor: { color: '#ccc', label: 'Risk factor' },
			_risk_factor: { color: '#ccc', label: 'Risk factor' },
			association: { color: '#ccc', label: 'Association' },
			_association: { color: '#ccc', label: 'Association' },
			Affects: { color: '#ccc', label: 'Affects' },
			_Affects: { color: '#ccc', label: 'Affects' },
			protective: { color: '#ccc', label: 'Protective' },
			_protective: { color: '#ccc', label: 'Protective' }
		}
	},
	tracks: [
		{
			__isgene: true,
			translatecoding: true,
			file: 'anno/refGene.hg38.gz',
			type: 'bedj',
			name: 'RefGene',
			stackheight: 16,
			stackspace: 1,
			vpad: 4,
			color: '#1D591D'
		},
		{
			__isgene: true,
			translatecoding: true,
			categories: {
				coding: { color: '#004D99', label: 'Coding gene' },
				nonCoding: { color: '#009933', label: 'Noncoding gene' },
				problem: { color: '#FF3300', label: 'Problem' },
				pseudo: { color: '#FF00CC', label: 'Pseudogene' }
			},
			file: 'anno/gencode.v34.hg38.gz',
			type: 'bedj',
			name: 'GENCODE v34',
			stackheight: 16,
			stackspace: 1,
			vpad: 4
		},
		{
			type: 'bedj',
			name: 'RepeatMasker',
			stackheight: 14,
			file: 'anno/rmsk.hg38.gz',
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
	defaultcoord: { chr: 'chr17', start: 7666657, stop: 7688274 },
	majorchr: `chr1	248956422
chr2	242193529
chr3	198295559
chr4	190214555
chr5	181538259
chr6	170805979
chr7	159345973
chr8	145138636
chr9	138394717
chr10	133797422
chr11	135086622
chr12	133275309
chr13	114364328
chr14	107043718
chr15	101991189
chr16	90338345
chr17	83257441
chr18	80373285
chr19	58617616
chr20	64444167
chr21	46709983
chr22	50818468
chrX	156040895
chrY	57227415
chrM	16569`,
	minorchr: `chr15_KI270905v1_alt	5161414 chr6_GL000256v2_alt	4929269 chr6_GL000254v2_alt	4827813 chr6_GL000251v2_alt	4795265 chr6_GL000253v2_alt	4677643
	chr6_GL000250v2_alt	4672374 chr6_GL000255v2_alt	4606388 chr6_GL000252v2_alt	4604811 chr17_KI270857v1_alt	2877074 chr16_KI270853v1_alt	2659700
	chr16_KI270728v1_random	1872759 chr17_GL000258v2_alt	1821992 chr5_GL339449v2_alt	1612928 chr14_KI270847v1_alt	1511111 chr17_KI270908v1_alt	1423190
	chr14_KI270846v1_alt	1351393 chr5_KI270897v1_alt	1144418 chr7_KI270803v1_alt	1111570 chr19_GL949749v2_alt	1091841 chr19_KI270938v1_alt	1066800
	chr19_GL949750v2_alt	1066390 chr19_GL949748v2_alt	1064304 chr19_GL949751v2_alt	1002683 chr19_GL949746v1_alt	987716 chr19_GL949752v1_alt	987100
	chr8_KI270821v1_alt	985506 chr1_KI270763v1_alt	911658 chr6_KI270801v1_alt	870480 chr19_GL949753v2_alt	796479 chr19_GL949747v2_alt	729520
	chr8_KI270822v1_alt	624492 chr4_GL000257v2_alt	586476 chr12_KI270904v1_alt	572349 chr4_KI270925v1_alt	555799 chr15_KI270852v1_alt	478999
	chr15_KI270727v1_random	448248 chr9_KI270823v1_alt	439082 chr15_KI270850v1_alt	430880 chr1_KI270759v1_alt	425601 chr12_GL877876v1_alt	408271
	chrUn_KI270442v1	392061 chr17_KI270862v1_alt	391357 chr15_GL383555v2_alt	388773 chr19_GL383573v1_alt	385657 chr4_KI270896v1_alt	378547
	chr4_GL383528v1_alt	376187 chr17_GL383563v3_alt	375691 chr8_KI270810v1_alt	374415 chr1_GL383520v2_alt	366580 chr1_KI270762v1_alt	354444
	chr15_KI270848v1_alt	327382 chr17_KI270909v1_alt	325800 chr14_KI270844v1_alt	322166 chr8_KI270900v1_alt	318687 chr10_GL383546v1_alt	309802
	chr13_KI270838v1_alt	306913 chr8_KI270816v1_alt	305841 chr22_KI270879v1_alt	304135 chr8_KI270813v1_alt	300230 chr11_KI270831v1_alt	296895
	chr15_GL383554v1_alt	296527 chr8_KI270811v1_alt	292436 chr18_GL383567v1_alt	289831 chrX_KI270880v1_alt	284869 chr8_KI270812v1_alt	282736
	chr19_KI270921v1_alt	282224 chr17_KI270729v1_random	280839 chr17_JH159146v1_alt	278131 chrX_KI270913v1_alt	274009 chr6_KI270798v1_alt	271782
	chr7_KI270808v1_alt	271455 chr22_KI270876v1_alt	263666 chr15_KI270851v1_alt	263054 chr22_KI270875v1_alt	259914 chr1_KI270766v1_alt	256271
	chr19_KI270882v1_alt	248807 chr3_KI270778v1_alt	248252 chr15_KI270849v1_alt	244917 chr4_KI270786v1_alt	244096 chr12_KI270835v1_alt	238139
	chr17_KI270858v1_alt	235827 chr19_KI270867v1_alt	233762 chr16_KI270855v1_alt	232857 chr8_KI270926v1_alt	229282 chr5_GL949742v1_alt	226852
	chr3_KI270780v1_alt	224108 chr17_GL383565v1_alt	223995 chr2_KI270774v1_alt	223625 chr4_KI270790v1_alt	220246 chr11_KI270927v1_alt	218612
	chr19_KI270932v1_alt	215732 chr11_KI270903v1_alt	214625 chr2_KI270894v1_alt	214158 chr14_GL000225v1_random	211173 chrUn_KI270743v1	210658
	chr11_KI270832v1_alt	210133 chr7_KI270805v1_alt	209988 chr4_GL000008v2_random	209709 chr7_KI270809v1_alt	209586 chr19_KI270887v1_alt	209512
	chr4_KI270789v1_alt	205944 chr3_KI270779v1_alt	205312 chr19_KI270914v1_alt	205194 chr19_KI270886v1_alt	204239 chr11_KI270829v1_alt	204059
	chr14_GL000009v2_random	201709 chr21_GL383579v2_alt	201197 chr11_JH159136v1_alt	200998 chr19_KI270930v1_alt	200773 chrUn_KI270747v1	198735
	chr18_GL383571v1_alt	198278
	chr19_KI270920v1_alt	198005
	chr6_KI270797v1_alt	197536
	chr3_KI270935v1_alt	197351
	chr17_KI270861v1_alt	196688
	chr15_KI270906v1_alt	196384
	chr5_KI270791v1_alt	195710
	chr14_KI270722v1_random	194050
	chr16_GL383556v1_alt	192462
	chr13_KI270840v1_alt	191684
	chr14_GL000194v1_random	191469
	chr11_JH159137v1_alt	191409
	chr19_KI270917v1_alt	190932
	chr7_KI270899v1_alt	190869
	chr19_KI270923v1_alt	189352
	chr10_KI270825v1_alt	188315
	chr19_GL383576v1_alt	188024
	chr19_KI270922v1_alt	187935
	chrUn_KI270742v1	186739
	chr22_KI270878v1_alt	186262
	chr19_KI270929v1_alt	186203
	chr11_KI270826v1_alt	186169
	chr6_KB021644v2_alt	185823
	chr17_GL000205v2_random	185591
	chr1_KI270765v1_alt	185285
	chr19_KI270916v1_alt	184516
	chr19_KI270890v1_alt	184499
	chr3_KI270784v1_alt	184404
	chr12_GL383551v1_alt	184319
	chr20_KI270870v1_alt	183433
	chrUn_GL000195v1	182896
	chr1_GL383518v1_alt	182439
	chr22_KI270736v1_random	181920
	chr10_KI270824v1_alt	181496
	chr14_KI270845v1_alt	180703
	chr3_GL383526v1_alt	180671
	chr13_KI270839v1_alt	180306
	chr22_KI270733v1_random	179772
	chrUn_GL000224v1	179693
	chr10_GL383545v1_alt	179254
	chrUn_GL000219v1	179198
	chr5_KI270792v1_alt	179043
	chr17_KI270860v1_alt	178921
	chr19_GL000209v2_alt	177381
	chr11_KI270830v1_alt	177092
	chr9_KI270719v1_random	176845
	chrUn_GL000216v2	176608
	chr22_KI270928v1_alt	176103
	chr1_KI270712v1_random	176043
	chr6_KI270800v1_alt	175808
	chr1_KI270706v1_random	175055
	chr2_KI270776v1_alt	174166
	chr18_KI270912v1_alt	174061
	chr3_KI270777v1_alt	173649
	chr5_GL383531v1_alt	173459
	chr3_JH636055v2_alt	173151
	chr14_KI270725v1_random	172810
	chr5_KI270796v1_alt	172708
	chr9_GL383541v1_alt	171286
	chr19_KI270885v1_alt	171027
	chr19_KI270919v1_alt	170701
	chr19_KI270889v1_alt	170698
	chr19_KI270891v1_alt	170680
	chr19_KI270915v1_alt	170665
	chr19_KI270933v1_alt	170537
	chr19_KI270883v1_alt	170399
	chr19_GL383575v2_alt	170222
	chr19_KI270931v1_alt	170148
	chr12_GL383550v2_alt	169178
	chr13_KI270841v1_alt	169134
	chrUn_KI270744v1	168472
	chr18_KI270863v1_alt	167999
	chr18_GL383569v1_alt	167950
	chr12_GL877875v1_alt	167313
	chr21_KI270874v1_alt	166743
	chr3_KI270924v1_alt	166540
	chr1_KI270761v1_alt	165834
	chr3_KI270937v1_alt	165607
	chr22_KI270734v1_random	165050
	chr18_GL383570v1_alt	164789
	chr5_KI270794v1_alt	164558
	chr4_GL383527v1_alt	164536
	chrUn_GL000213v1	164239
	chr3_KI270936v1_alt	164170
	chr3_KI270934v1_alt	163458
	chr9_GL383539v1_alt	162988
	chr3_KI270895v1_alt	162896
	chr22_GL383582v2_alt	162811
	chr3_KI270782v1_alt	162429
	chr1_KI270892v1_alt	162212
	chrUn_GL000220v1	161802
	chr2_KI270767v1_alt	161578
	chr2_KI270715v1_random	161471
	chr2_KI270893v1_alt	161218
	chrUn_GL000218v1	161147
	chr18_GL383572v1_alt	159547
	chr8_KI270817v1_alt	158983
	chr4_KI270788v1_alt	158965
	chrUn_KI270749v1	158759
	chr7_KI270806v1_alt	158166
	chr7_KI270804v1_alt	157952
	chr18_KI270911v1_alt	157710
	chrUn_KI270741v1	157432
	chr17_KI270910v1_alt	157099
	chr19_KI270884v1_alt	157053
	chr19_GL383574v1_alt	155864
	chr19_KI270888v1_alt	155532
	chr3_GL000221v1_random	155397
	chr11_GL383547v1_alt	154407
	chr2_KI270716v1_random	153799
	chr12_GL383553v2_alt	152874
	chr6_KI270799v1_alt	152148
	chr22_KI270731v1_random	150754
	chrUn_KI270751v1	150742
	chrUn_KI270750v1	148850
	chr8_KI270818v1_alt	145606
	chrX_KI270881v1_alt	144206
	chr21_KI270873v1_alt	143900
	chr2_GL383521v1_alt	143390
	chr8_KI270814v1_alt	141812
	chr12_GL383552v1_alt	138655
	chrUn_KI270519v1	138126
	chr2_KI270775v1_alt	138019
	chr17_KI270907v1_alt	137721
	chrUn_GL000214v1	137718
	chr8_KI270901v1_alt	136959
	chr2_KI270770v1_alt	136240
	chr16_KI270854v1_alt	134193
	chr8_KI270819v1_alt	133535
	chr17_GL383564v2_alt	133151
	chr2_KI270772v1_alt	133041
	chr8_KI270815v1_alt	132244
	chr5_KI270795v1_alt	131892
	chr5_KI270898v1_alt	130957
	chr20_GL383577v2_alt	128386
	chr1_KI270708v1_random	127682
	chr7_KI270807v1_alt	126434
	chr5_KI270793v1_alt	126136
	chr6_GL383533v1_alt	124736
	chr2_GL383522v1_alt	123821
	chr19_KI270918v1_alt	123111
	chr12_GL383549v1_alt	120804
	chr2_KI270769v1_alt	120616
	chr4_KI270785v1_alt	119912
	chr12_KI270834v1_alt	119498
	chr7_GL383534v2_alt	119183
	chr20_KI270869v1_alt	118774
	chr21_GL383581v2_alt	116689
	chr3_KI270781v1_alt	113034
	chr17_KI270730v1_random	112551
	chrUn_KI270438v1	112505
	chr4_KI270787v1_alt	111943
	chr18_KI270864v1_alt	111737
	chr2_KI270771v1_alt	110395
	chr1_GL383519v1_alt	110268
	chr2_KI270768v1_alt	110099
	chr1_KI270760v1_alt	109528
	chr3_KI270783v1_alt	109187
	chr17_KI270859v1_alt	108763
	chr11_KI270902v1_alt	106711
	chr18_GL383568v1_alt	104552
	chr22_KI270737v1_random	103838
	chr13_KI270843v1_alt	103832
	chr22_KI270877v1_alt	101331
	chr5_GL383530v1_alt	101241
	chr11_KI270721v1_random	100316
	chr22_KI270738v1_random	99375
	chr22_GL383583v2_alt	96924
	chr2_GL582966v2_alt	96131
	chrUn_KI270748v1	93321
	chrUn_KI270435v1	92983
	chr5_GL000208v1_random	92689
	chrUn_KI270538v1	91309
	chr17_GL383566v1_alt	90219
	chr16_GL383557v1_alt	89672
	chr17_JH159148v1_alt	88070
	chr5_GL383532v1_alt	82728
	chr21_KI270872v1_alt	82692
	chrUn_KI270756v1	79590
	chr6_KI270758v1_alt	76752
	chr12_KI270833v1_alt	76061
	chr6_KI270802v1_alt	75005
	chr21_GL383580v2_alt	74653
	chr22_KB663609v1_alt	74013
	chr22_KI270739v1_random	73985
	chr9_GL383540v1_alt	71551
	chrUn_KI270757v1	71251
	chr2_KI270773v1_alt	70887
	chr17_JH159147v1_alt	70345
	chr11_KI270827v1_alt	67707
	chr1_KI270709v1_random	66860
	chrUn_KI270746v1	66486
	chr16_KI270856v1_alt	63982
	chr21_GL383578v2_alt	63917
	chrUn_KI270753v1	62944
	chr19_KI270868v1_alt	61734
	chr9_GL383542v1_alt	60032
	chr20_KI270871v1_alt	58661
	chr12_KI270836v1_alt	56134
	chr19_KI270865v1_alt	52969
	chr1_KI270764v1_alt	50258
	chrUn_KI270589v1	44474
	chr14_KI270726v1_random	43739
	chr19_KI270866v1_alt	43156
	chr22_KI270735v1_random	42811
	chr1_KI270711v1_random	42210
	chrUn_KI270745v1	41891
	chr1_KI270714v1_random	41717
	chr22_KI270732v1_random	41543
	chr1_KI270713v1_random	40745
	chrUn_KI270754v1	40191
	chr1_KI270710v1_random	40176
	chr12_KI270837v1_alt	40090
	chr9_KI270717v1_random	40062
	chr14_KI270724v1_random	39555
	chr9_KI270720v1_random	39050
	chr14_KI270723v1_random	38115
	chr9_KI270718v1_random	38054
	chrUn_KI270317v1	37690
	chr13_KI270842v1_alt	37287
	chrY_KI270740v1_random	37240
	chrUn_KI270755v1	36723
	chr8_KI270820v1_alt	36640
	chr1_KI270707v1_random	32032
	chrUn_KI270579v1	31033
	chrUn_KI270752v1	27745
	chrUn_KI270512v1	22689
	chrUn_KI270322v1	21476
	chrUn_GL000226v1	15008
	chrUn_KI270311v1	12399
	chrUn_KI270366v1	8320
	chrUn_KI270511v1	8127
	chrUn_KI270448v1	7992
	chrUn_KI270521v1	7642
	chrUn_KI270581v1	7046
	chrUn_KI270582v1	6504
	chrUn_KI270515v1	6361
	chrUn_KI270588v1	6158
	chrUn_KI270591v1	5796
	chrUn_KI270522v1	5674
	chrUn_KI270507v1	5353
	chrUn_KI270590v1	4685
	chrUn_KI270584v1	4513
	chrUn_KI270320v1	4416
	chrUn_KI270382v1	4215
	chrUn_KI270468v1	4055
	chrUn_KI270467v1	3920
	chrUn_KI270362v1	3530
	chrUn_KI270517v1	3253
	chrUn_KI270593v1	3041
	chrUn_KI270528v1	2983
	chrUn_KI270587v1	2969
	chrUn_KI270364v1	2855
	chrUn_KI270371v1	2805
	chrUn_KI270333v1	2699
	chrUn_KI270374v1	2656
	chrUn_KI270411v1	2646
	chrUn_KI270414v1	2489
	chrUn_KI270510v1	2415
	chrUn_KI270390v1	2387
	chrUn_KI270375v1	2378
	chrUn_KI270420v1	2321
	chrUn_KI270509v1	2318
	chrUn_KI270315v1	2276
	chrUn_KI270302v1	2274
	chrUn_KI270518v1	2186
	chrUn_KI270530v1	2168
	chrUn_KI270304v1	2165
	chrUn_KI270418v1	2145
	chrUn_KI270424v1	2140
	chrUn_KI270417v1	2043
	chrUn_KI270508v1	1951
	chrUn_KI270303v1	1942
	chrUn_KI270381v1	1930
	chrUn_KI270529v1	1899
	chrUn_KI270425v1	1884
	chrUn_KI270396v1	1880
	chrUn_KI270363v1	1803
	chrUn_KI270386v1	1788
	chrUn_KI270465v1	1774
	chrUn_KI270383v1	1750
	chrUn_KI270384v1	1658
	chrUn_KI270330v1	1652
	chrUn_KI270372v1	1650
	chrUn_KI270548v1	1599
	chrUn_KI270580v1	1553
	chrUn_KI270387v1	1537
	chrUn_KI270391v1	1484
	chrUn_KI270305v1	1472
	chrUn_KI270373v1	1451
	chrUn_KI270422v1	1445
	chrUn_KI270316v1	1444
	chrUn_KI270338v1	1428
	chrUn_KI270340v1	1428
	chrUn_KI270583v1	1400
	chrUn_KI270334v1	1368
	chrUn_KI270429v1	1361
	chrUn_KI270393v1	1308
	chrUn_KI270516v1	1300
	chrUn_KI270389v1	1298
	chrUn_KI270466v1	1233
	chrUn_KI270388v1	1216
	chrUn_KI270544v1	1202
	chrUn_KI270310v1	1201
	chrUn_KI270412v1	1179
	chrUn_KI270395v1	1143
	chrUn_KI270376v1	1136
	chrUn_KI270337v1	1121
	chrUn_KI270335v1	1048
	chrUn_KI270378v1	1048
	chrUn_KI270379v1	1045
	chrUn_KI270329v1	1040
	chrUn_KI270419v1	1029
	chrUn_KI270336v1	1026
	chrUn_KI270312v1	998
	chrUn_KI270539v1	993
	chrUn_KI270385v1	990
	chrUn_KI270423v1	981
	chrUn_KI270392v1	971
	chrUn_KI270394v1	970`
}
