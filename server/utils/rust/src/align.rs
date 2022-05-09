// Syntax: cd .. && cargo build --release && echo single:TGCAATTCAGGGTCAAGCTTCCTGAGGCATTTGTGCCAAAAGTGCCTGTCTTTAAAGATCAGGATTTCTNCCCTCA:CATCCACGCCTGAAGGAAGAGATGGCCAAAATGAAGAGATCAAATGCAATTCAGGTTCAAGCTTCCTGAGGGATTTGCGCCAAAAGTGCCTAAAATATATGTAAAAAGAAATGTAAATTGAAAAACAATCTTTCACCTTTAGAATATTTTCCTCA:CATCCACGCCTGAAGGAAGAGATGGCCAAAATGAAGAGATCAAATGCAATTCAGGTTCAAGCTTCCTGAGGGATTTGTGCCAAAAGTGCCTAAAATATATGTAAAAAGAAATGTAAATTGAAAAACAATCTTTCACCTTTAGAATATTTTCCTCA:45M864N31M:102839198:102839231:C:T | target/release/align
// Syntax: cd .. && cargo build --release && echo multi:AGAGGAATCCGTAGGACATCTGCTTATCATTTTTGTAGGCCAAACAGTTCTGACTGAAACTCGGAGAAACACGGACATCAGGCCGGACGCAACTGGTCAGATGCTGGAAACCTCAGCCTGCACGGGAGTCAGAGGCACTCAGCAATGCCGTGGCTCTGTTACGAACGGCTGAAATCAAAACCCCTCTGGCTTCTCCTATGCTTGT:ATCCGTAGGACATCTGCTTATCATTTTTGTAGGCCAAACAGTTCTGACTGAAACTCGGAGAAACACGGACATCAGGCCGGACGCAACTGGTAGATCGGAAG:ATCTTCTGCTTATCATTTTTGTAGGCCAAACAGTTCTGACTGAAACTCGGAGAAACACGGACATCAGGCCGGACGCAACTGGTCAGATGCTGGAAACCTCA:CATCTGCTTATCATTTTTGTAGGCCAAACAGTTCTGACTGAAACTCGGAGAAACACGGACATCAGGCCGGACGCAACTGGTCAGATGCTGGAAACCTCAGC:TCTGCTTATCATTTTTGTAGGCCAAACAGTTCTGACTGAAACTCGGAGAAACACGGACATCAGGCCGGACGCAACTGGTCAGATGCTGGAAACCTCAAGAT:CTGCTTATCATTTTTGTAGGCCAAACAGTTCTGACTGAAACTCGGAGAAACACGGACATCAGGCCGGACGCAACTGGTCAGATGCTGGAAACCTCAGCCTG:CTGCTTATCATTTTTGTAGGCCAAACAGTTCTGACTGAAACTCGGAGAAACACGGACATCAGGCCGGACGCAACTGGTCAGATGCTGGAAACCTCAGCCTG:CATTTTTGTAGGCCAAACAGTTCTGACTGAAACTCGGAGAAACACGGACATCAGGCCGGACGCAACTGGTCAGATGCTGGAAACCTCAGCCTGTTTGGAAA:CATTTTTGTAGGCCAAACAGTTCTGACTGAAACTCGGAGAAACACGGACATCAGGCCGGACGCAACTGGTCAGATGCTGGAAACCTCAGCCTGCACGGGAG:TGTAGGCCAAACAGTTCTGACTGAAACTCGGAGAAACACGGACATCAGGCCGGACGCAACTGGTCAGATGCTGGAAACCTCAGCCTGCACGGGAGTCAGAG:CCAAACAGTTCTGACTGAAACTCGGAGAAACACGGACATCAGGCCGGACGCAACTGGTCAGATGCTGGAAACCTCAGCCTGCACGGGAGTCAGAGGCACTC:CAAACAGTTCTGACTGAAACTCGGAGAAACACGGACATCAGGCCGGACGCAACTGGTCAGATGCTGGAAACCTCAGCCTGTTTGGAAACAGTATATGATGT:AACTCGGAGAAACACGGACATCAGGCCGGACGCAACTGGTCAGATGCTGGAAACCTCAGCCTGCACGGGAGTCAGAGGCACTCAGCAATGCCATGGCTCTG:ACTCGGAGAAACACGGACATCAGGCCGGACGCAACTGGTCAGATGCTGGAAACCTCAGCCTGCACGGGAGTCAGAGGCACTCAGCAATGCCATGGCTCTGT:ACACGGACATCAGGCCGGACGCAACTGGTCAGATGCTGGAAACCTCAGCCTGCACGGGAGTCAGAGGCACTCAGCAATGCCATGGCTCTGTTACGAACGGC:GTCAGATGCTGGAAACCTCAGCCTGCACGGGAGTCAGAGGCACTCAGCAATGCCATGGCTCTGTTACGAACGGCTGAAATCAAAACCCCTCTGGCTTCTCC | time ../target/release/align

// Function Cascade:
// Single-read alignment mode: When first word in input is "single", it triggers the single-read alignment mode. The first sequence is the query sequence, second is reference sequence and third is alternate sequence. Each read/ref/alt sequence is separated by ":" character.
//       align_single_reads(query_sequence, reference_sequence)
//       align_single_reads(query_sequence, alternate_sequence)
// Multi-read alignment mode: When first word in input is "multi", it triggers the multi-read alignment mode in which multiple reads are aligned against a single reference using pairwise alignment. Each read/ref sequence is separated by ":" character.
//       for read in reads
//          align_multi_reads(read, reference_sequence)
//
// NOTE: Currently the multi-read alignment mode is not in use because it will not be able to handle cases where a read opens a gap in the reference sequence outside the proposed variant region. This will require a more complex implementation. For now "clustalo" is being used.

use bio::alignment::pairwise::*;
use bio::alignment::AlignmentOperation;
//use bio::scores::blosum62;
use std::io;

mod realign;

fn main() {
    let mut input = String::new();
    match io::stdin().read_line(&mut input) {
        // Accepting the piped input from nodejs (or command line from testing)
        #[allow(unused_variables)]
        Ok(n) => {
            //println!("{} bytes read", n);
            //println!("{}", input);
        }
        Err(error) => println!("Piping error: {}", error),
    }
    let args: Vec<&str> = input.split(":").collect(); // Various input from nodejs is separated by ":" character
    let align_case: String = args[0].parse::<String>().unwrap(); // Single-read alignment or multi-read alignment
    if align_case == "single".to_string() {
        let query_seq: String = args[1].parse::<String>().unwrap(); // Query sequence
        let ref_seq: String = args[2].parse::<String>().unwrap().replace("\n", ""); // Reference sequence. Removing "\n" from the end of string
        let alt_seq: String = args[3].parse::<String>().unwrap().replace("\n", ""); // Alternate sequence. Removing "\n" from the end of string
        let cigar_seq = args[4].parse::<String>().unwrap().replace("\n", ""); // Contains cigar characters
        let read_start = args[5].parse::<i64>().unwrap(); // Contains start position of read
        let variant_pos = args[6].parse::<i64>().unwrap(); // Contains variant position
        let variant_ref = args[7].parse::<String>().unwrap(); // Contains variant reference
        let variant_alt = args[8].parse::<String>().unwrap().replace("\n", ""); // Contains variant alternate

        let mut indel_length: i64 = variant_alt.len() as i64; // Determining indel length, in case of an insertion it will be alt_length. In case of a deletion, it will be ref_length
        if variant_ref.len() > variant_alt.len() {
            indel_length = variant_ref.len() as i64;
        }
        let (
            _within_indel,
            correct_start_position,
            correct_end_position,
            splice_freq,
            splice_start_pos,
            splice_stop_pos,
            _splice_start_cigar,
            _splice_stop_cigar,
            alignment_side,
        ) = realign::check_read_within_indel_region(
            // Checks if the read contains the indel region (or a part of it)
            read_start,
            cigar_seq.to_owned(),
            variant_pos,
            indel_length as usize,
            variant_ref.len(),
            variant_alt.len(),
            1, // Using strictness = 1
            query_seq.len(),
        );

        let mut final_sequence = query_seq.to_owned(); // No splicing
        if splice_freq > 0 {
            final_sequence = String::new(); // Contains spliced sequences which overlaps with indel region. If read not spliced, contains entire sequence
            let sequence_vector: Vec<_> = query_seq.chars().collect(); // Vector containing each sequence nucleotides as separate elements in the vector

            //println!("splice_start_pos:{}", splice_start_pos);
            //println!("splice_stop_pos:{}", splice_stop_pos);
            for k in splice_start_pos..splice_stop_pos {
                if (k as usize) < sequence_vector.len() {
                    final_sequence += &sequence_vector[k as usize].to_string();
                }
            }
        }
        //println!("final_sequence:{}", final_sequence);

        let (q_seq_ref, align_ref, r_seq_ref, _matched_nucleotides_ratio) =
            realign::align_single_reads(&final_sequence, ref_seq); // Aligning against reference
        let (q_seq_alt, align_alt, r_seq_alt, _matched_nucleotides_ratio) =
            realign::align_single_reads(&final_sequence, alt_seq); // Aligning against alternate

        // Determine start/stop position of nucleotides in read that need to be highlighted red to show variant region in UI
        let mut red_region_start_alt = 0;
        let mut red_region_start_ref = 0;
        let mut red_region_stop_ref = 0;
        let mut red_region_stop_alt = 0;
        //println!("variant_ref.len():{}", variant_ref.len());
        //println!("variant_alt.len():{}", variant_alt.len());
        //println!("q_seq_temp_alt.len():{}", q_seq_alt.len());
        //println!("q_seq_temp_ref.len():{}", q_seq_ref.len());
        //println!("correct_end_position:{}", correct_end_position);
        if alignment_side == "left".to_string() {
            red_region_start_alt = (variant_pos - correct_start_position).abs();
            red_region_start_ref = (variant_pos - correct_start_position).abs();
            red_region_stop_ref =
                (variant_pos - correct_start_position).abs() + variant_ref.len() as i64;
            red_region_stop_alt =
                (variant_pos - correct_start_position).abs() + variant_alt.len() as i64;
        } else if alignment_side == "right".to_string() {
            let correctly_aligned_nclt_in_right =
                correct_end_position - variant_pos - variant_ref.len() as i64;
            //println!(
            //    "correctly_aligned_nclt_in_right:{}",
            //    correctly_aligned_nclt_in_right
            //);
            red_region_start_alt =
                q_seq_alt.len() as i64 - correctly_aligned_nclt_in_right - variant_alt.len() as i64;
            red_region_start_ref =
                q_seq_ref.len() as i64 - correctly_aligned_nclt_in_right - variant_ref.len() as i64;
            red_region_stop_alt = q_seq_alt.len() as i64 - correctly_aligned_nclt_in_right;
            red_region_stop_ref = r_seq_ref.len() as i64 - correctly_aligned_nclt_in_right;
        }

        if red_region_start_alt < 0 {
            red_region_start_alt = 0;
        }

        if red_region_start_ref < 0 {
            red_region_start_ref = 0;
        }

        if red_region_stop_alt < 0 {
            red_region_stop_alt = 0;
        }

        if red_region_stop_ref < 0 {
            red_region_stop_ref = 0;
        }

        //println!("red_disp_region_start_alt:{}", red_region_start_alt);
        //println!("red_disp_region_start_ref:{}", red_region_start_ref);
        //println!("red_disp_region_stop_alt:{}", red_region_stop_alt);
        //println!("red_disp_region_stop_ref:{}", red_region_stop_ref);

        println!("q_seq_ref:{}", q_seq_ref);
        println!("align_ref:{}", align_ref);
        println!("r_seq_ref:{}", r_seq_ref);
        println!("q_seq_alt:{}", q_seq_alt);
        println!("align_alt:{}", align_alt);
        println!("r_seq_alt:{}", r_seq_alt);
        println!("red_region_start_alt:{}", red_region_start_alt);
        println!("red_region_start_ref:{}", red_region_start_ref);
        println!("red_region_stop_alt:{}", red_region_stop_alt);
        println!("red_region_stop_ref:{}", red_region_stop_ref);
    } else if align_case == "multi".to_string() {
        let ref_seq: String = args[1].parse::<String>().unwrap(); // First sequence is always reference sequence
        let mut main_seq: String = String::new();
        let mut subst_vector: String = String::new();
        for i in 2..args.len() {
            #[allow(unused_variables)]
            //println!("UnRead:{}", &args[i].parse::<String>().unwrap());
            let (q_seq, r_seq, subst) = align_multi_reads(
                &args[i].parse::<String>().unwrap().replace("\n", ""),
                &ref_seq,
            );
            subst_vector += &subst;
            println!("Read:{}", q_seq);
            main_seq = r_seq;
        }
        println!("Refs:{}", main_seq);
        println!("Subst_vector:{}", subst_vector);
    } else {
        println!("This option is not recognized");
    }
}

fn align_multi_reads(query_seq: &String, ref_seq: &String) -> (String, String, String) {
    let query_vector: Vec<_> = query_seq.chars().collect();
    let ref_vector: Vec<_> = ref_seq.chars().collect();

    let score = |a: u8, b: u8| if a == b { 1i32 } else { -1i32 };
    // gap open score: -5, gap extension score: -1

    let mut aligner = Aligner::with_capacity(
        query_seq.as_bytes().len(),
        ref_seq.as_bytes().len(),
        -5, // gap open penalty
        -1, // gap extension penalty
        &score,
    );

    let alignment = aligner.global(query_seq.as_bytes(), ref_seq.as_bytes());
    //let alignment = aligner.semiglobal(query_seq.as_bytes(), ref_seq.as_bytes());
    //let alignment = aligner.local(query_seq.as_bytes(), ref_seq.as_bytes());

    //let scoring = Scoring::from_scores(-5, -1, 1, -1) // Gap open, extend, match, mismatch score
    //    .xclip(MIN_SCORE) // Clipping penalty for x set to 'negative infinity', hence global in x
    //    .yclip(MIN_SCORE); // Clipping penalty for y set to 'negative infinity', hence global in y
    //
    //let mut aligner = Aligner::with_scoring(scoring);
    //let alignment = aligner.custom(query_seq.as_bytes(), ref_seq.as_bytes());

    let alignment_seq = alignment.operations;
    //println!("alignment_seq:{:?}", alignment_seq);
    let mut q_seq: String = String::new();
    let mut r_seq: String = String::new();
    let mut j: usize = 0;
    let mut k: usize = 0;
    let mut subst: String = String::new();
    for i in 0..alignment_seq.len() {
        if AlignmentOperation::Match == alignment_seq[i] {
            if j < query_vector.len() {
                q_seq += &query_vector[j].to_string();
                j += 1;
            }
            if k < ref_vector.len() {
                r_seq += &ref_vector[k].to_string();
                k += 1;
            }
        } else if AlignmentOperation::Subst == alignment_seq[i] {
            //println!("query:{}", &query_vector[j].to_string());
            subst += &(i.to_string() + ";");
            //println!("pos:{}", i);
            //println!("ref:{}", &ref_vector[k].to_string());
            if j < query_vector.len() {
                q_seq += &query_vector[j].to_string();
                j += 1;
            }
            if k < ref_vector.len() {
                r_seq += &ref_vector[k].to_string();
                k += 1;
            }
        } else if AlignmentOperation::Del == alignment_seq[i] {
            if j == 0 || j >= query_vector.len() {
                // Add blank before start and after end of read
                q_seq += &" ".to_string();
            } else {
                q_seq += &"-".to_string();
            }
            if k < ref_vector.len() {
                r_seq += &ref_vector[k].to_string();
                k += 1;
            }
        } else if AlignmentOperation::Ins == alignment_seq[i] {
            if j < query_vector.len() {
                q_seq += &query_vector[j].to_string();
                j += 1;
            }
            r_seq += &"-".to_string();
        } else {
            // Should not happen, added to help debug if it ever happens
            println!("Alignment operation not found:{}{:?}", i, alignment_seq[i]);
        }
    }
    subst += ":";
    //println!("subst:{}", subst);
    (q_seq, r_seq, subst)
}
